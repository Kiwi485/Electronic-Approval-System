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


// 如果在本地 → 使用 emulator
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // 與 firebase.json 對齊的高位埠設定
  connectFirestoreEmulator(db, "localhost", 58080);
  connectAuthEmulator(auth, "http://localhost:59099");
  connectStorageEmulator(storage, "localhost", 59199);
  console.log("✅ Connected to Firebase Emulators (ports: fs=58080, auth=59099, storage=59199)");
}


export { db, auth, storage };
