// login.js - Email/密碼登入邏輯 (正確路徑)
import { loginEmailPassword, mapAuthError, waitAuthReady } from './auth.js';

const form = document.getElementById('loginForm');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const rememberEl = document.getElementById('remember');
const errorEl = document.getElementById('loginError');
const btn = document.getElementById('loginBtn');

function setLoading(state) {
  btn.disabled = state;
  btn.innerHTML = state ? '<span class="spinner-border spinner-border-sm me-1"></span>登入中...' : '<i class="bi bi-box-arrow-in-right me-1"></i>登入';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('d-none');
  setLoading(true);
  try {
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || !password) throw new Error('請填寫 Email 與密碼');
    await loginEmailPassword(email, password, rememberEl.checked);
    const params = new URLSearchParams(location.search);
    const r = params.get('r') || 'index.html';
    location.replace(r);
  } catch (err) {
    const msg = err.code ? mapAuthError(err.code) : err.message;
    errorEl.textContent = msg;
    errorEl.classList.remove('d-none');
  } finally {
    setLoading(false);
  }
});

// 若已登入自動跳首頁
waitAuthReady().then(u => { if (u) location.replace('index.html'); });
