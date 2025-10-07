// prototype/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js";

// ⚡ 用你的 Firebase Console 設定
const firebaseConfig = {
  apiKey: "你的 API KEY",
  authDomain: "electronic-approval-dev.firebaseapp.com",
  projectId: "electronic-approval-dev",
  storageBucket: "electronic-approval-dev.appspot.com",
  messagingSenderId: "xxxxxxx",
  appId: "xxxxxxxx"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化服務
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


// 如果在本地或啟用 emu=1 → 使用 Emulator
try {
  const params = new URLSearchParams(location.search || '');
  const forceEmu = params.has('emu');
  const host = location.hostname; // 例如：127.0.0.1、localhost、或區網/公網 IP（手機測試用）
  const isLocalLike = host === 'localhost' || host === '127.0.0.1' || /^(\d+\.){3}\d+$/.test(host);
  if (forceEmu || isLocalLike) {
    connectFirestoreEmulator(db, host, 8080);
    connectAuthEmulator(auth, `http://${host}:9099`);
    connectStorageEmulator(storage, host, 9199);
    console.log(`✅ Connected to Firebase Emulators at ${host} (fs:8080, auth:9099, storage:9199)`);
  }
} catch (e) {
  console.warn('[firebase-init] emulator connect decision failed:', e);
}


export { db, auth, storage };
