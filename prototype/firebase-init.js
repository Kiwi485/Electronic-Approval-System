// prototype/firebase-init.js
<<<<<<< HEAD
// 使用 CDN ES module 版本（9.22.1），並匯出 db, auth, storage
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js';

// 真實 Firebase config（由使用者提供）
const firebaseConfig = {
  apiKey: "AIzaSyAil2nwTz1GxGMLH_xems7zwVs2J1i0YFk",
  authDomain: "smart-system-f188f.firebaseapp.com",
  projectId: "smart-system-f188f",
  storageBucket: "smart-system-f188f.firebasestorage.app",
  messagingSenderId: "11088320717",
  appId: "1:11088320717:web:05473e6ca7f6a657747184",
  measurementId: "G-B82CNKKGR1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // analytics may fail in some environments; ignore
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };
=======
// prototype/firebase-init.js (legacy re-export)
// 仍然保留這個入口以確保舊版 HTML 可以正常運作。
// 建議改用 `./js/firebase-init.js`。

export { app, db, auth, storage, usingEmulators } from './js/firebase-init.js';
>>>>>>> 8116f3c (新增登入頁面、簽單內容)
