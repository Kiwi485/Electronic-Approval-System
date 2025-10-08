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
const isLocalHost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
const useEmulators = forceEmu || (!forceProd && isLocalHost);

if (useEmulators) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099");
    connectStorageEmulator(storage, "localhost", 9199);
    console.log("✅ Using Firebase Emulators (Firestore:8080 Auth:9099 Storage:9199)");
  } catch (e) {
    console.warn("⚠️ Failed to connect to emulators:", e);
  }
} else {
  console.log("✅ Using Firebase Production Services");
}


export { db, auth, storage };
