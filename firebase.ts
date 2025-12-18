
import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
// Fix: Consolidated value and type imports from 'firebase/auth' to resolve exported member errors
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

// ⚠️ 請在此處替換為您的 Firebase 設定
// 如果您只是想在本機測試，本系統會自動偵測並切換至 LocalStorage 模式
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

const isPlaceholder = (str: string) => str.includes("YOUR_") || str === "";

if (!isPlaceholder(firebaseConfig.apiKey)) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
    console.log("✅ Firebase 已成功連線");
  } catch (error) {
    console.error("❌ Firebase 初始化失敗:", error);
  }
} else {
  console.warn("⚠️ Firebase 未設定，將使用本機儲存模式 (LocalStorage)。");
}

export { auth, db, isConfigured };
