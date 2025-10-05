// prototype/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js";

// ⚡ 用你的 Firebase Console 設定
const firebaseConfig = {
  apiKey: "AIzaSyAil2nwTz1GxGMLH_xems7zwVs2J1i0YFk",
  authDomain: "smart-system-f188f.firebaseapp.com",
  projectId: "smart-system-f188f",
  storageBucket: "smart-system-f188f.firebasestorage.app",
  messagingSenderId: "11088320717",
  appId: "1:11088320717:web:05473e6ca7f6a657747184",
  measurementId: "G-B82CNKKGR1"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化服務
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const usingEmulators = false;

export { app, db, auth, storage, usingEmulators };
