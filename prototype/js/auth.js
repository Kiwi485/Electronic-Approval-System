// prototype/js/auth.js
import { auth } from './firebase-init.js';
import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js';

const REDIRECT_KEY = 'eas:postLoginRedirect';
const persistenceReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.warn('[Auth] 設定登入持續性失敗，將改用預設持續性。', error);
});

const driverDirectory = {
  'dev@example.com': {
    name: '測試司機',
    vehicleNumber: 'V001'
  }
};

const errorMessages = {
  'auth/invalid-email': 'Email 格式不正確，請重新輸入。',
  'auth/user-disabled': '此帳號已被停用，請洽系統管理員。',
  'auth/user-not-found': '查無此帳號，請確認 Email 或聯絡管理員。',
  'auth/wrong-password': '密碼不正確，請再次確認。',
  'auth/too-many-requests': '嘗試次數過多，請稍後再試。'
};

function getDriverProfile(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const profile = driverDirectory[normalized];
  if (profile) {
    return { email: normalized, ...profile };
  }
  const fallbackName = normalized.split('@')[0];
  return {
    email: normalized,
    name: fallbackName,
    vehicleNumber: '未設定'
  };
}

function rememberRedirect(pathname) {
  try {
    sessionStorage.setItem(REDIRECT_KEY, pathname);
  } catch (error) {
    console.warn('[Auth] 無法儲存登入後導向，sessionStorage 不可用。', error);
  }
}

function consumeRedirect(defaultTarget = 'index.html') {
  try {
    const target = sessionStorage.getItem(REDIRECT_KEY);
    if (target) {
      sessionStorage.removeItem(REDIRECT_KEY);
      return target;
    }
  } catch (error) {
    console.warn('[Auth] 讀取登入後導向失敗。', error);
  }
  return defaultTarget;
}

async function signIn(email, password) {
  await persistenceReady;
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

async function signOutUser({ redirectToLogin = false } = {}) {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch (error) {
    console.warn('[Auth] 清除登入後導向失敗。', error);
  }
  await signOut(auth);
  if (redirectToLogin) {
    window.location.replace('login.html');
  }
}

function translateAuthError(error) {
  if (!error) return '登入過程發生不明錯誤，請稍後再試。';
  const code = error.code || error.message;
  return errorMessages[code] || '登入失敗，請確認帳號密碼後再試。';
}

function subscribeAuth(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (typeof callback === 'function') {
      callback(user, user ? getDriverProfile(user.email) : null);
    }
  });
}

function ensureAuth({ redirectIfMissing = true } = {}) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user && redirectIfMissing) {
        rememberRedirect(window.location.pathname + window.location.search);
        window.location.replace('login.html');
        resolve(null);
        return;
      }
      resolve(user);
    });
  });
}

export {
  consumeRedirect,
  ensureAuth,
  getDriverProfile,
  rememberRedirect,
  signIn,
  signOutUser,
  subscribeAuth,
  translateAuthError
};
