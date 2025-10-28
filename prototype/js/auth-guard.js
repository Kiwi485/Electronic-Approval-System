// auth-guard.js - 共用頁面保護 + 登出 + 使用者 Email 顯示
import { requireAuth, logout, waitAuthReady } from './auth.js';
import { waitForProfile } from './session-context.js';
import { db } from '../firebase-init.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

let headerDisplayName = '';
let notificationState = null;

function ensureDropdown(btn) {
  if (!btn || btn.dataset.dropdownBound === '1') return;
  const menu = btn.nextElementSibling;
  if (!menu) return;
  btn.dataset.dropdownBound = '1';

  try {
    const Dropdown = window.bootstrap?.Dropdown;
    if (Dropdown) {
      Dropdown.getOrCreateInstance(btn);
      return;
    }
  } catch (err) {
    console.warn('[auth-guard] bootstrap dropdown init failed', err);
  }

  let manualOpen = false;
  let closeListener = null;
  let escListener = null;

  const detachDocumentListeners = () => {
    if (closeListener) {
      document.removeEventListener('click', closeListener, true);
      closeListener = null;
    }
    if (escListener) {
      document.removeEventListener('keydown', escListener, true);
      escListener = null;
    }
  };

  const closeManual = () => {
    if (!manualOpen) return;
    menu.classList.remove('show');
    menu.style.removeProperty('display');
    btn.setAttribute('aria-expanded', 'false');
    manualOpen = false;
    detachDocumentListeners();
  };

  const manualToggle = () => {
    if (manualOpen) {
      closeManual();
      return;
    }
    document.querySelectorAll('.dropdown-menu.show').forEach(other => {
      if (other === menu) return;
      other.classList.remove('show');
      other.style.removeProperty('display');
      const toggle = other.previousElementSibling;
      if (toggle?.matches('[data-bs-toggle="dropdown"]')) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    menu.classList.add('show');
    menu.style.display = 'block';
    btn.setAttribute('aria-expanded', 'true');
    manualOpen = true;
    closeListener = (evt) => {
      if (menu.contains(evt.target) || btn.contains(evt.target)) return;
      closeManual();
    };
    escListener = (evt) => {
      if (evt.key === 'Escape') closeManual();
    };
    document.addEventListener('click', closeListener, true);
    document.addEventListener('keydown', escListener, true);
  };

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    manualToggle();
  });
}

function primeAllDropdowns() {
  document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(el => ensureDropdown(el));
}

  function applyHeaderDisplayName() {
    if (!headerDisplayName) return;
    const span = document.getElementById('currentUserEmail');
    if (span) span.textContent = headerDisplayName;
  }

  function applyNotificationUi() {
    if (!notificationState) return;
    const notifBtn = document.getElementById('notifButton');
    const notifBadge = document.getElementById('notifBadge');
    const notifMenu = document.getElementById('notifMenu');
    if (!notifBtn || !notifBadge || !notifMenu) return;
    ensureDropdown(notifBtn);
    const records = Array.isArray(notificationState.records) ? notificationState.records : [];
    const newIds = notificationState.newIds instanceof Set ? notificationState.newIds : new Set();
    const renderedItems = records.map(record => {
      const { id, title, desc } = record;
      const isNew = newIds.has(id);
      const badge = isNew ? '<span class="badge bg-danger ms-2">新</span>' : '';
      return `<li><a class="dropdown-item d-flex justify-content-between align-items-center" href="sign-delivery.html?id=${encodeURIComponent(id)}"><span><i class="bi bi-bell me-2"></i>${title} <small class="text-muted ms-1">${desc}</small></span>${badge}</a></li>`;
    });
    notificationState.count = records.length;
    const badgeCount = records.length;
    if (badgeCount > 0) {
      notifBadge.textContent = String(badgeCount);
      notifBadge.classList.remove('d-none');
      const limitedItems = renderedItems.slice(0, 5).join('');
      notifMenu.innerHTML = limitedItems + '<li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="sign-delivery.html"><i class="bi bi-list-check me-2"></i>查看待簽章</a></li>';
    } else {
      notifBadge.classList.add('d-none');
      notifMenu.innerHTML = '<li class="dropdown-item text-muted small">目前沒有新通知</li>';
    }
    if (notifBtn.dataset.resetListener !== '1') {
      notifBtn.dataset.resetListener = '1';
      notifBtn.addEventListener('click', () => {
        const current = notificationState;
        if (!current) return;
        const { newCount: currentNewCount, lastKey: currentKey } = current;
        if (currentKey && currentNewCount && currentNewCount > 0) {
          localStorage.setItem(currentKey, String(Date.now()));
          current.newCount = 0;
          current.newIds = new Set();
          applyNotificationUi();
        }
      });
    }
  }

  function bindLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    const toggleBtn = logoutBtn.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]');
    ensureDropdown(toggleBtn);
    if (logoutBtn.dataset.logoutBound === '1') return;
    logoutBtn.dataset.logoutBound = '1';
    logoutBtn.addEventListener('click', async (e) => {
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
  }

  document.addEventListener('nav-ready', () => {
    primeAllDropdowns();
    applyHeaderDisplayName();
    applyNotificationUi();
    bindLogoutButton();
  });

  function bootstrapHeaderUiOnceDomReady() {
    primeAllDropdowns();
    applyHeaderDisplayName();
    applyNotificationUi();
    bindLogoutButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapHeaderUiOnceDomReady, { once: true });
  } else {
    bootstrapHeaderUiOnceDomReady();
  }

// 先要求驗證（會自動隱藏整體再顯示），並等待角色/個資載入避免閃爍
requireAuth('login.html', {
  afterAuth: async () => {
    try {
      await waitForProfile();
    } catch (err) {
      console.warn('[auth-guard] waitForProfile failed', err);
    }
    applyHeaderDisplayName();
    applyNotificationUi();
    bindLogoutButton();
  }
});

// 顯示使用者姓名（無姓名則顯示 Email 的 @ 前段）
waitAuthReady().then(async u => {
  if (!u) return;
  let name = u.displayName || '';
  try {
    const profile = await waitForProfile();
    if (profile?.displayName) name = profile.displayName;
  } catch {}
  if (!name && u.email) name = u.email.split('@')[0];
  headerDisplayName = name || '';
  applyHeaderDisplayName();

  // 通知紅點（僅司機）：顯示新指派（尚未簽章）
  try {
    const uid = u.uid;
    const lastKey = uid ? `notif_last_seen_assignments_${uid}` : 'notif_last_seen_assignments';
    if (uid) {
      try { localStorage.removeItem('notif_last_seen_assignments'); } catch {}
    }
    const lastSeen = Number(localStorage.getItem(lastKey) || '0');
    let snap;
    if (uid) {
      try {
        const q1 = query(collection(db, 'deliveryNotes'), where('assignedTo', 'array-contains', uid));
        snap = await getDocs(q1);
      } catch (err) {
        const q2 = query(collection(db, 'deliveryNotes'), where('readableBy', 'array-contains', uid));
        snap = await getDocs(q2);
      }
    }
    if (snap) {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pendingItems = items.filter(x => (x.signatureStatus || 'pending') === 'pending');
      const newOnes = pendingItems.filter(x => {
        const t = x.serverCreatedAt?.toDate ? x.serverCreatedAt.toDate().getTime() : (new Date(x.serverCreatedAt || x.createdAt || 0).getTime());
        return Number.isFinite(t) && t > lastSeen;
      });
      const newIdSet = new Set(newOnes.map(x => x.id));
      notificationState = {
        count: pendingItems.length,
        newCount: newOnes.length,
        lastKey,
        records: pendingItems.map(x => ({
          id: x.id,
          title: x.customer || '新簽單',
          desc: x.location || x.origin || ''
        })),
        newIds: newIdSet
      };
      applyNotificationUi();
    } else {
      notificationState = { count: 0, newCount: 0, lastKey, records: [], newIds: new Set() };
      applyNotificationUi();
    }
  } catch (err) {
    console.warn('[auth-guard] notifications setup failed', err);
    notificationState = { count: 0, newCount: 0, lastKey: null, records: [], newIds: new Set() };
    applyNotificationUi();
  }

  applyHeaderDisplayName();
  applyNotificationUi();
  bindLogoutButton();
});

