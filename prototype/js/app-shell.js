// prototype/js/app-shell.js
import { ensureAuth, subscribeAuth, signOutUser } from './auth.js';

ensureAuth();

const logoutLinks = Array.from(document.querySelectorAll('.js-logout'));
logoutLinks.forEach((link) => {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    link.disabled = true;
    link.classList.add('disabled');
    try {
      await signOutUser({ redirectToLogin: true });
    } catch (error) {
      console.error('[AppShell] 登出失敗', error);
      link.disabled = false;
      link.classList.remove('disabled');
    }
  }, { once: true });
});

subscribeAuth((user, profile) => {
  const nameEls = document.querySelectorAll('[data-user-name]');
  const emailEls = document.querySelectorAll('[data-user-email]');
  const name = profile?.name || profile?.email || user?.displayName || user?.email || '使用者';
  const email = profile?.email || user?.email || '';

  nameEls.forEach((el) => { el.textContent = name; });
  emailEls.forEach((el) => { el.textContent = email; });
});
