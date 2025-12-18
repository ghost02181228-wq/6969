
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isConfigured = false;

try {
  const firebaseConfigStr = process.env.FIREBASE_CONFIG;
  if (firebaseConfigStr) {
    const config = JSON.parse(firebaseConfigStr);
    if (!getApps().length) {
      app = initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);
      isConfigured = true;
      console.log("Firebase 初始化成功");
    }
  } else {
    console.warn("未偵測到 Firebase 配置，系統將以離線/展示模式運作");
  }
} catch (error) {
  console.error("Firebase 初始化失敗:", error);
}

export { auth, db, isConfigured };
