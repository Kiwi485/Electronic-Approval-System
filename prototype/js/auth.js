// auth.js - Email/密碼登入狀態管理與保護
import { auth } from '../firebase-init.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js';

let currentUser = null;
let authReady = false;
const listeners = [];

function waitAuthReady() {
  if (authReady) return Promise.resolve(currentUser);
  return new Promise(resolve => {
    listeners.push(resolve);
  });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authReady = true;
  listeners.splice(0).forEach(fn => fn(user));
  document.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user }}));
});

async function loginEmailPassword(email, password, remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

async function logout() { await signOut(auth); }

function getCurrentUser() { return currentUser; }

function requireAuth(redirectTo = 'login.html', options = {}) {
  // 呼叫時立即先隱藏主體避免閃爍
  const root = document.documentElement;
  root.style.visibility = 'hidden';
  waitAuthReady().then(async user => {
    if (!user) {
      location.replace(redirectTo + '?r=' + encodeURIComponent(location.pathname + location.search));
      return;
    }
    if (typeof options.afterAuth === 'function') {
      try {
        await options.afterAuth(user);
      } catch (err) {
        console.warn('[auth] afterAuth callback failed', err);
      }
    }
    root.style.visibility = 'visible';
  });
}

function mapAuthError(code) {
  switch(code) {
    case 'auth/invalid-email': return 'Email 格式不正確';
    case 'auth/user-disabled': return '此帳號已被停用';
    case 'auth/user-not-found': return '帳號不存在';
    case 'auth/wrong-password': return '密碼錯誤';
    case 'auth/too-many-requests': return '嘗試次數過多，請稍後再試';
    default: return '登入失敗：' + code;
  }
}

export { loginEmailPassword, logout, requireAuth, waitAuthReady, mapAuthError, getCurrentUser };
