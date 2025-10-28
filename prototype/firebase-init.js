// prototype/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-functions.js";

// ⚡ 用你的 Firebase Console 設定
const firebaseConfig = {

  apiKey: "AIzaSyBW9oC8vHFpD1uVeZwLq9ADI8aGdsg5lB0",

  authDomain: "electronic-approval-dev.firebaseapp.com",

  projectId: "electronic-approval-dev",

  storageBucket: "electronic-approval-dev.firebasestorage.app",

  messagingSenderId: "673548971499",

  appId: "1:673548971499:web:c553e15dd131f2cc84fdae",

  measurementId: "G-3JBC64DM94"

};


// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化服務
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, "asia-east1");


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
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log("✅ Using Firebase Emulators (Firestore:8080 Auth:9099 Storage:9199)");
  } catch (e) {
    console.warn("⚠️ Failed to connect to emulators:", e);
  }
} else {
  console.log("✅ Using Firebase Production Services");
}


export { db, auth, storage, functions };
