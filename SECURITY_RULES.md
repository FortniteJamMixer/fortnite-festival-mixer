# Firebase Security Rules (Safe Community Metrics)

## Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Community stats are readable by anyone.
    match /stats/{document=**} {
      allow read: if true;
      allow write: if false;
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
