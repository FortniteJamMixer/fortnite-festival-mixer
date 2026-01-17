# Firebase Security Rules (Safe Community Metrics)

## Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && (
        get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.isAdmin == true ||
        get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == "admin"
      );
    }

    // Community stats are readable by anyone.
    match /stats/{document=**} {
      allow read: if true;
      allow write: if false;
    }

    match /appStats/{document=**} {
      allow read: if true;
      allow write: if false;
    }

    match /appConfig/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }

    // Profiles + ratings (client-owned docs).
    match /profiles/{userId} {
      allow read: if resource.data.isPublic == true || (request.auth != null && request.auth.uid == userId);
      // Only allow users to update their own profile.
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;

      match /ratings/{raterId} {
        allow read: if get(/databases/$(database)/documents/profiles/$(userId)).data.isPublic == true
          || (request.auth != null && request.auth.uid == userId);
        // Raters can only write their own rating doc.
        allow write: if request.auth != null && request.auth.uid == raterId;
      }
    }

    match /friendRequests/{requestId} {
      allow create: if request.auth != null && request.resource.data.fromUid == request.auth.uid;
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.fromUid ||
        request.auth.uid == resource.data.toUid
      );
      allow update: if request.auth != null && (
        (request.auth.uid == resource.data.fromUid
          && request.resource.data.fromUid == resource.data.fromUid
          && request.resource.data.toUid == resource.data.toUid
          && request.resource.data.status == "canceled")
        ||
        (request.auth.uid == resource.data.toUid
          && request.resource.data.fromUid == resource.data.fromUid
          && request.resource.data.toUid == resource.data.toUid
          && request.resource.data.status in ["accepted", "declined"])
      );
      allow delete: if false;
    }

    match /friends/{uid}/list/{friendUid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && (request.auth.uid == uid || request.auth.uid == friendUid);
    }

    // Per-visitor docs are server-only.
    match /metricsVisitors/{visitorId} {
      allow read, write: if false;
    }

    // Existing user/profile collections remain unchanged here.
  }
}
```

## Realtime Database (presence only)
```
{
  "rules": {
    "presence": {
      "$uid": {
        ".read": true,
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

Notes:
- Presence writes are authenticated via anonymous auth; clients only touch their own `presence/{uid}` node.
- Community stats remain read-only on the client; all increments/peaks are computed in serverless API routes.
- Firebase Console: Auth → Sign-in method → Anonymous must be turned ON for presence to function.
- If you key profile documents by username (instead of auth UID), update `userId`/`raterId` checks accordingly (e.g., compare against a username stored in a custom claim or document field).
