import { onObjectFinalized } from "firebase-functions/v2/storage";
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

    const gcsUri = `gs://${object.bucket}/${object.name}`;
    let safeSearch = {};
    try {
      const [result] = await visionClient.safeSearchDetection(gcsUri);
      safeSearch = result?.safeSearchAnnotation || {};
    } catch (err) {
      logger.error("SafeSearch failed", err);
      await updateAvatarProfile(uid, {
        status: "rejected",
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
