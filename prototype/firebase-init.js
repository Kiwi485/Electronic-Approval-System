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


// 是否使用 Emulator 可由查詢參數控制：
//   ?emu=1      強制使用 Emulator
//   ?prod=1     在本機也使用正式環境（停用 Emulator）
const params = new URLSearchParams(location.search);
const forceProd = params.get('prod') === '1';
const forceEmu = params.get('emu') === '1' || params.get('useEmu') === '1';
const host = location.hostname; // 支援 localhost、127.0.0.1、或區網 IP（手機測試）
const isIp = /^(\d+\.){3}\d+$/.test(host);
const isLocalLike = (host === 'localhost' || host === '127.0.0.1' || isIp);
const useEmulators = forceEmu || (!forceProd && isLocalLike);

if (useEmulators) {
  try {
    connectFirestoreEmulator(db, host, 8080);
    connectAuthEmulator(auth, `http://${host}:9099`);
    connectStorageEmulator(storage, host, 9199);
    console.log(`✅ Using Firebase Emulators at ${host} (fs:8080 auth:9099 storage:9199)`);
  } catch (e) {
    console.warn("⚠️ Failed to connect to emulators:", e);
  }
} else {
  console.log("✅ Using Firebase Production Services");
}


export { db, auth, storage };
