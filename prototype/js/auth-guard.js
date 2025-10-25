// auth-guard.js - 共用頁面保護 + 登出 + 使用者 Email 顯示
import { requireAuth, logout, waitAuthReady } from './auth.js';
import { waitForProfile } from './session-context.js';

// 先要求驗證（會自動隱藏整體再顯示），並等待角色/個資載入避免閃爍
requireAuth('login.html', {
  afterAuth: async () => {
    try {
      await waitForProfile();
    } catch (err) {
      console.warn('[auth-guard] waitForProfile failed', err);
    }
  }
});

// 顯示使用者 Email
waitAuthReady().then(u => {
  const span = document.getElementById('currentUserEmail');
  if (span && u) span.textContent = u.email || '';
});

// 綁定登出
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  if (logoutBtn.dataset.loading === '1') return;
  logoutBtn.dataset.loading = '1';
  const original = logoutBtn.innerHTML;
  logoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>登出中';
  try {
    await logout();
    location.replace('login.html');
  } catch (err) {
    alert('登出失敗：' + err.message);
    logoutBtn.innerHTML = original;
  } finally {
    logoutBtn.dataset.loading = '0';
  }
});
