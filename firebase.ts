
import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
// Fix: Use consolidated imports to avoid "no exported member" errors in some environments
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

// 請在此處貼上您的 Firebase Web 設定
// 您可以在 Firebase Console -> 專案設定 -> 一般 -> 您的應用程式中找到這段內容
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let isConfigured = false;

// 檢查是否已填寫設定 (非預設值)
if (firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      isConfigured = true;
    }
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
  }
}

export { auth, db, isConfigured };
