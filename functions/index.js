import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import vision from "@google-cloud/vision";
import crypto from "node:crypto";

initializeApp();

const db = getFirestore();
const storage = getStorage();
const visionClient = new vision.ImageAnnotatorClient();

const PENDING_PREFIX = "avatarsPending/";
const APPROVED_PREFIX = "avatars/";
const REJECT_THRESHOLD = new Set(["LIKELY", "VERY_LIKELY"]);
const MAX_PENDING_BYTES = 300 * 1024;
const DEFAULT_VERIFIED_AVATAR_CONFIG = Object.freeze({
  verifiedAvatarsEnabled: true,
  verifiedAvatarsPausedReason: "",
  verifiedAvatarsPausedAt: null,
  verifiedAvatarsDailyGlobalLimit: 200,
  verifiedAvatarsDailyUserLimit: 3,
  verifiedAvatarsCooldownSeconds: 120,
});

function parsePendingPath(name = "") {
  const match = name.match(/^avatarsPending\/([^/.]+)\.(webp|png|jpe?g)$/i);
  if (!match) return null;
  return { uid: match[1], ext: match[2] };
}

function shouldRejectSafeSearch(safeSearch = {}) {
  return ["adult", "violence", "racy"].some((key) => REJECT_THRESHOLD.has(safeSearch[key]));
}

function buildDownloadUrl(bucket, path, token) {
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&token=${token}`;
}

function normalizeVerifiedAvatarConfig(data = {}) {
  return { ...DEFAULT_VERIFIED_AVATAR_CONFIG, ...data };
}

function startOfDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isSameDay(left, right) {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

async function updateAvatarProfile(uid, avatarPayload) {
  if (!uid) return;
  const profileRef = db.collection("profiles").doc(uid);
  await profileRef.set(
    {
      avatar: avatarPayload,
    },
    { merge: true }
  );
}

export const reserveVerifiedAvatarSlot = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to verify.");
    }
    const appConfigRef = db.collection("appConfig").doc("public");
    const appStatsRef = db.collection("appStats").doc("verifiedAvatars");
    const userRef = db.collection("users").doc(uid);
    const now = new Date();
    const dayStart = startOfDay(now);
    const nowTs = Timestamp.fromDate(now);
    const dayStartTs = Timestamp.fromDate(dayStart);

    return db.runTransaction(async (transaction) => {
      const [configSnap, statsSnap, userSnap] = await Promise.all([
        transaction.get(appConfigRef),
        transaction.get(appStatsRef),
        transaction.get(userRef),
      ]);

      const config = normalizeVerifiedAvatarConfig(configSnap.data() || {});
      if (!config.verifiedAvatarsEnabled) {
        return {
          allowed: false,
          reason:
            config.verifiedAvatarsPausedReason ||
            "Verified avatars paused (daily free quota reached). Try again tomorrow.",
          code: "paused",
        };
      }

      const cooldownSeconds = Number(config.verifiedAvatarsCooldownSeconds || 0);
      const userLimit = Number(config.verifiedAvatarsDailyUserLimit || 0);
      const globalLimit = Number(config.verifiedAvatarsDailyGlobalLimit || 0);

      const userData = userSnap.data()?.avatarVerify || {};
      const userWindowStart = userData.windowStart?.toDate?.() || null;
      const userAttempts = isSameDay(userWindowStart, dayStart)
        ? Number(userData.attemptsInWindow || 0)
        : 0;
      const userLastAttempt = userData.lastAttemptAt?.toDate?.() || null;
      if (userLastAttempt && cooldownSeconds > 0) {
        const elapsedSeconds = Math.floor((now.getTime() - userLastAttempt.getTime()) / 1000);
        if (elapsedSeconds < cooldownSeconds) {
          return {
            allowed: false,
            reason: `Cooldown active. Try again in ${cooldownSeconds - elapsedSeconds}s.`,
            code: "cooldown",
          };
        }
      }
      if (userLimit > 0 && userAttempts >= userLimit) {
        return {
          allowed: false,
          reason: "Daily per-user free quota reached.",
          code: "user_limit",
        };
      }

      const statsData = statsSnap.data() || {};
      const statsWindowStart = statsData.windowStart?.toDate?.() || null;
      const globalAttempts = isSameDay(statsWindowStart, dayStart)
        ? Number(statsData.attemptsInWindow || 0)
        : 0;

      if (globalLimit > 0 && globalAttempts >= globalLimit) {
        transaction.set(
          appConfigRef,
          {
            verifiedAvatarsEnabled: false,
            verifiedAvatarsPausedReason: "Daily free quota reached",
            verifiedAvatarsPausedAt: nowTs,
          },
          { merge: true }
        );
        return {
          allowed: false,
          reason: "Verified avatars paused (daily free quota reached). Try again tomorrow.",
          code: "global_limit",
        };
      }

      const nextUserAttempts = userAttempts + 1;
      const nextGlobalAttempts = globalAttempts + 1;

      transaction.set(
        userRef,
        {
          avatarVerify: {
            windowStart: dayStartTs,
            attemptsInWindow: nextUserAttempts,
            lastAttemptAt: nowTs,
          },
        },
        { merge: true }
      );
      transaction.set(
        appStatsRef,
        {
          windowStart: dayStartTs,
          attemptsInWindow: nextGlobalAttempts,
        },
        { merge: true }
      );

      if (globalLimit > 0 && nextGlobalAttempts >= globalLimit) {
        transaction.set(
          appConfigRef,
          {
            verifiedAvatarsEnabled: false,
            verifiedAvatarsPausedReason: "Daily free quota reached",
            verifiedAvatarsPausedAt: nowTs,
          },
          { merge: true }
        );
      }

      return {
        allowed: true,
        remainingGlobal: globalLimit > 0 ? Math.max(0, globalLimit - nextGlobalAttempts) : null,
        remainingUser: userLimit > 0 ? Math.max(0, userLimit - nextUserAttempts) : null,
      };
    });
  }
);

export const moderatePendingAvatar = onObjectFinalized(
  { region: "us-central1" },
  async (event) => {
    const object = event.data;
    if (!object?.name || !object?.bucket) return;
    if (!object.name.startsWith(PENDING_PREFIX)) return;

    const parsed = parsePendingPath(object.name);
    if (!parsed) return;

    const { uid } = parsed;
    const contentType = object.contentType || "";
    if (!contentType.startsWith("image/")) {
      await updateAvatarProfile(uid, {
        status: "rejected",
        mode: "verified",
        url: null,
        updatedAt: Timestamp.now(),
        rejectedReason: "Unsupported file type",
        rejectedLabels: null,
      });
      await storage.bucket(object.bucket).file(object.name).delete({ ignoreNotFound: true });
      return;
    }
    const sizeBytes = Number(object.size || 0);
    if (Number.isFinite(sizeBytes) && sizeBytes > MAX_PENDING_BYTES) {
      await updateAvatarProfile(uid, {
        status: "rejected",
        mode: "verified",
        url: null,
        updatedAt: Timestamp.now(),
        rejectedReason: "Image too large",
        rejectedLabels: null,
      });
      await storage.bucket(object.bucket).file(object.name).delete({ ignoreNotFound: true });
      return;
    }

    const gcsUri = `gs://${object.bucket}/${object.name}`;
    let safeSearch = {};
    try {
      const [result] = await visionClient.safeSearchDetection(gcsUri);
      safeSearch = result?.safeSearchAnnotation || {};
    } catch (err) {
      logger.error("SafeSearch failed", err);
      await updateAvatarProfile(uid, {
        status: "error",
        mode: "verified",
        url: null,
        updatedAt: Timestamp.now(),
        rejectedReason: "Moderation unavailable",
        rejectedLabels: null,
      });
      await storage.bucket(object.bucket).file(object.name).delete({ ignoreNotFound: true });
      return;
    }

    const rejectedLabels = {
      adult: safeSearch.adult || "UNKNOWN",
      violence: safeSearch.violence || "UNKNOWN",
      racy: safeSearch.racy || "UNKNOWN",
      medical: safeSearch.medical || "UNKNOWN",
      spoof: safeSearch.spoof || "UNKNOWN",
    };

    if (shouldRejectSafeSearch(safeSearch)) {
      await updateAvatarProfile(uid, {
        status: "rejected",
        mode: "verified",
        url: null,
        updatedAt: Timestamp.now(),
        rejectedReason: "Inappropriate image",
        rejectedLabels,
      });
      await storage.bucket(object.bucket).file(object.name).delete({ ignoreNotFound: true });
      return;
    }

    const bucket = storage.bucket(object.bucket);
    const destPath = `${APPROVED_PREFIX}${uid}.webp`;
    const destFile = bucket.file(destPath);
    const downloadToken = crypto.randomUUID();

    await bucket.file(object.name).copy(destFile, {
      metadata: {
        contentType: "image/webp",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const downloadUrl = buildDownloadUrl(object.bucket, destPath, downloadToken);

    await updateAvatarProfile(uid, {
      status: "approved",
      mode: "verified",
      url: downloadUrl,
      updatedAt: Timestamp.now(),
      rejectedReason: null,
      rejectedLabels: null,
    });

    await bucket.file(object.name).delete({ ignoreNotFound: true });
  }
);
