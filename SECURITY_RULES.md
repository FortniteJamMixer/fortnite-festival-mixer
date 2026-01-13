# Firebase Security Rules (Safe Community Metrics)

## Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"
      );
    }

    // Community stats are readable by anyone.
    match /stats/{document=**} {
      allow read: if true;
      allow write: if false;
    }

    match /appConfig/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Profile + ratings (client-owned docs).
    match /users/{userId} {
      allow read: if true;
      // Only allow users to update their own profile.
      allow write: if request.auth != null && request.auth.uid == userId;

      match /ratings/{raterId} {
        allow read: if true;
        // Raters can only write their own rating doc.
        allow write: if request.auth != null && request.auth.uid == raterId;
      }
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
- If you key user documents by username (instead of auth UID), update `userId`/`raterId` checks accordingly (e.g., compare against a username stored in a custom claim or document field).
