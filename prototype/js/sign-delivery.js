// sign-delivery.js - 單獨簽章頁面
import { db } from '../firebase-init.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js';
import { storage } from '../firebase-init.js';
import { offlineManager } from './offline.js';
import { waitAuthReady } from './auth.js';
import { getUserContext, onUserRoleReady } from './session-context.js';
import { ensureUsageAppliedForDelivery } from './machine-usage.js';

console.info('[SignDelivery] layout version 20251027c');

// 供離線使用的 key（最小變更：直接讀寫 localStorage）
const OFFLINE_NOTES_KEY = 'offline_delivery_notes';
const SIG_QUEUE_KEY = 'offline_signatures_queue';

// 新列表元素
const pendingListEl = document.getElementById('pendingList');
const pendingLoadingEl = document.getElementById('pendingLoading');
const noPendingEl = document.getElementById('noPending');
const reloadListBtn = document.getElementById('reloadList');
const selectHintEl = document.getElementById('selectHint');

// 舊錯誤（輸入模式）改為通用錯誤 (保留引用安全)
const loadError = document.getElementById('loadError');
const noteSection = document.getElementById('noteSection');
const noteBody = document.getElementById('noteBody');
const signaturePadCanvas = document.getElementById('signaturePad');
const clearBtn = document.getElementById('clearSignature');
const saveBtn = document.getElementById('saveSignature');
const signatureError = document.getElementById('signatureError');
const statusBadge = document.getElementById('signatureStatusBadge');
const signedPreview = document.getElementById('signedPreview');
const signatureImg = document.getElementById('signatureImg');
const signedAtText = document.getElementById('signedAtText');
const redoSignature = document.getElementById('redoSignature');
const debugLogEl = document.getElementById('debugLog');
const listSectionEl = document.getElementById('listSection');
const receivedCashEl = document.getElementById('receivedCash');

const PAID_BADGE_HTML = '<span class="badge bg-success"><i class="bi bi-cash-coin me-1"></i>已收款</span>';
const UNPAID_BADGE_HTML = '<span class="badge bg-secondary"><i class="bi bi-clock-history me-1"></i>待收款</span>';
const MACHINE_PLACEHOLDER_REGEX = /選擇機具/;

let paidLocked = false;
let paidLockedValue = false;

function getPaidBadge(checked) {
  return checked ? PAID_BADGE_HTML : UNPAID_BADGE_HTML;
}

function updatePaidStatusLabel() {
  const statusText = document.getElementById('paidStatusText');
  if (statusText && receivedCashEl) {
    statusText.innerHTML = getPaidBadge(receivedCashEl.checked);
  }
}

function applyPaidState(checked, locked = false) {
  if (!receivedCashEl) return;
  paidLocked = !!locked;
  paidLockedValue = !!checked;
  receivedCashEl.checked = paidLockedValue;
  receivedCashEl.disabled = paidLocked;
  receivedCashEl.classList.toggle('cursor-not-allowed', paidLocked);
  updatePaidStatusLabel();
}

receivedCashEl?.addEventListener('change', () => {
  if (!receivedCashEl) return;
  if (paidLocked) {
    receivedCashEl.checked = paidLockedValue;
    return;
  }
  updatePaidStatusLabel();
});

let currentDocId = null;        // 線上文件 id
let currentLocalId = null;      // 離線暫存 id
let hasSignature = false;
let ctx;
let currentRole = null;
let currentUid = null;
let currentEmail = null;
let userContextReady = false;
let userContextPromise = null;
let currentNoteData = null;
let usageCheckInFlight = null;
let unsubscribePendingRealtime = null;
let canvasDpr = 1;
let canvasCssWidth = 0;
let canvasCssHeight = 0;
let pendingListLoadSeq = 0;

function escapeAttrValue(value) {
  if (value == null) return '';
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/"/g, '\"');
}

function clearOfflineInjectedRows() {
  if (!pendingListEl) return;
  pendingListEl.querySelectorAll('li[data-local-id]').forEach((node) => node.remove());
}

function removeExistingPendingEntry({ docId, localId }) {
  if (!pendingListEl) return;
  if (docId) {
    const selector = `li[data-doc-id="${escapeAttrValue(docId)}"]`;
    pendingListEl.querySelectorAll(selector).forEach(node => node.remove());
  }
  if (localId) {
    const selector = `li[data-local-id="${escapeAttrValue(localId)}"]`;
    pendingListEl.querySelectorAll(selector).forEach(node => node.remove());
  }
}

onUserRoleReady(({ role, profile }) => {
  if (role) currentRole = role;
  const profileEmail = profile?.email || profile?.contactEmail || null;
  if (profileEmail) currentEmail = profileEmail;
});

async function applyUserContext(ctx = {}) {
  const profileEmail = ctx.profile?.email || ctx.profile?.contactEmail || null;
  const user = ctx.user || await waitAuthReady().catch(() => null);
  currentUid = ctx.uid || user?.uid || currentUid || null;
  currentRole = ctx.role || currentRole || 'driver';
  currentEmail = profileEmail || user?.email || currentEmail || null;
  userContextReady = true;
  logDebug('user context ready', { role: currentRole, uid: currentUid });
  return { role: currentRole, uid: currentUid };
}

function waitForUserContext() {
  if (userContextPromise) return userContextPromise;
  userContextPromise = getUserContext()
    .then((ctx) => applyUserContext(ctx))
    .catch(async (error) => {
      logDebug('getUserContext fallback', { message: error?.message });
      return applyUserContext();
    });
  return userContextPromise;
}

function getTimestampValue(input) {
  if (!input) return 0;
  if (typeof input.toDate === 'function') {
    try { return input.toDate().getTime(); } catch { return 0; }
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function logDebug(msg, data) {
  const ts = new Date().toISOString().split('T')[1]?.replace('Z','') || '';
  if (debugLogEl) {
    debugLogEl.textContent += `[#${ts}] ${msg}` + (data ? ` => ${JSON.stringify(data)}` : '') + "\n";
  }
  console.log('[SignDebug]', msg, data||'');
}

function formatQuantity(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function getMachineLabel(note = {}) {
  const pick = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = pick(entry);
        if (text) {
          if (MACHINE_PLACEHOLDER_REGEX.test(text)) return '';
          return text;
        }
      }
      return '';
    }
    if (typeof value === 'object') {
      const name = value.modelName || value.displayName || value.name || value.label || value.title;
      if (name) {
        const text = String(name).trim();
        if (MACHINE_PLACEHOLDER_REGEX.test(text)) return '';
        return text;
      }
      return '';
    }
    if (typeof value === 'string') {
      const text = value.trim();
      if (MACHINE_PLACEHOLDER_REGEX.test(text)) return '';
      return text;
    }
    const text = String(value).trim();
    if (MACHINE_PLACEHOLDER_REGEX.test(text)) return '';
    return text;
  };
  const candidates = [
    note.machineName,
    note.modelName,
    note.machineModel,
    note.machine,
    note.machines,
    note.machineId
  ];
  for (const candidate of candidates) {
    const text = pick(candidate);
    if (text) return text;
  }
  return '-';
}

function renderEmptyState(message = '目前沒有待簽章項目') {
  try {
    if (pendingListEl) pendingListEl.innerHTML = '';
    if (noPendingEl) {
      noPendingEl.textContent = message;
      noPendingEl.classList.remove('d-none');
    }
    if (pendingLoadingEl) pendingLoadingEl.style.display = 'none';
    if (pendingListEl) pendingListEl.style.display = 'block';
    if (!listSectionEl) return;
    // 移除或隱藏任何遺留的錯誤提示樣式
    const dangerAlerts = listSectionEl.querySelectorAll('.alert-danger, .text-danger');
    dangerAlerts.forEach(node => {
      if (!node) return;
      if (typeof node.classList?.remove === 'function') {
        node.classList.remove('alert-danger', 'text-danger');
        node.classList.add('text-muted');
      }
      if (!node.dataset.cleaned) {
        node.textContent = message;
        node.dataset.cleaned = 'true';
      }
    });
    const nodesWithErrorText = listSectionEl.querySelectorAll('*');
    nodesWithErrorText.forEach(node => {
      if (!node || typeof node.textContent !== 'string') return;
      if (node.textContent.includes('載入失敗')) {
        if (node === pendingListEl || node.contains(pendingListEl)) return;
        node.textContent = message;
        if (typeof node.classList?.add === 'function') {
          node.classList.remove('alert', 'alert-danger', 'text-danger');
          node.classList.add('text-muted');
        }
      }
    });
  } catch (err) {
    console.warn('[SignDebug] renderEmptyState suppress error', err);
  }
}

function setStatusBadge(status) {
  let c = 'bg-secondary';
  let t = '未設定';
  if (status === 'pending') { c = 'bg-warning text-dark'; t = '待簽章'; }
  else if (status === 'completed') { c = 'bg-success'; t = '已完成'; }
  statusBadge.className = 'badge ' + c;
  statusBadge.textContent = t;
}

async function loadNote(id) {
  if (!id) return;
  logDebug('loadNote start', { id });
  if (loadError) loadError.classList.add('d-none');
  currentDocId = null;
  noteSection.classList.add('d-none');
  try {
    const ref = doc(db, 'deliveryNotes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      logDebug('note not found', { id });
      if (loadError) {
        loadError.textContent = '找不到此簽單';
        loadError.classList.remove('d-none');
      }
      return;
    }
    const data = snap.data();
    currentDocId = snap.id;
    logDebug('note loaded', { id: snap.id });
    renderNote(data);
  } catch (e) {
    console.error(e);
    logDebug('loadNote error', { message: e.message, code: e.code });
    if (loadError) {
      loadError.textContent = '載入失敗：' + e.message;
      loadError.classList.remove('d-none');
    }
  }
}

async function loadPendingList() {
  if (!userContextReady) {
    logDebug('loadPendingList skipped: user context pending');
    await waitForUserContext();
  }
  logDebug('loadPendingList start');
  const runId = ++pendingListLoadSeq;
  const isLatest = () => runId === pendingListLoadSeq;
  pendingListEl.style.display = 'none';
  pendingLoadingEl.style.display = 'block';
  noPendingEl.classList.add('d-none');
  pendingListEl.innerHTML = '';

  if (navigator.onLine) clearOfflineInjectedRows();

  // 僅在離線狀態下才注入離線項目，避免與線上資料重覆
  if (!navigator.onLine) {
    try { injectLatestOffline(); } catch (e) { logDebug('injectLatestOffline on load failed', { message: e.message }); }
  }
  let timeoutHit = false;
  const to = setTimeout(() => {
    timeoutHit = true;
    logDebug('pendingList timeout fallback triggered (5s)');
    if (isLatest()) {
      pendingLoadingEl.innerHTML = '<span class="text-warning small">載入逾時，嘗試較簡單查詢...</span>';
    }
  }, 5000);
  try {
    // 為了徹底避免因規則造成的全域 list 拒絕，簽章頁一律以「司機可見」範圍載入待簽清單
    if (!currentUid) {
      logDebug('driver uid missing, pending list abort');
      pendingListEl.innerHTML = `<li class="list-group-item text-danger">無法取得使用者資訊，請重新登入。</li>`;
      pendingLoadingEl.style.display = 'none';
      pendingListEl.style.display = 'block';
      return;
    }

    const assignedQuery = query(collection(db, 'deliveryNotes'), where('assignedTo', 'array-contains', currentUid));
    const createdQuery = query(collection(db, 'deliveryNotes'), where('createdBy', '==', currentUid));
    const fallbackQuery = query(collection(db, 'deliveryNotes'), where('assignedDriverUid', '==', currentUid));
    const emailQuery = currentEmail ? query(collection(db, 'deliveryNotes'), where('assignedDriverEmail', '==', currentEmail)) : null;
    const readablePendingQuery = (() => {
      try {
        if (currentRole === 'manager') {
          return query(collection(db, 'deliveryNotes'), where('signatureStatus', '==', 'pending'), limit(200));
        }
        return query(collection(db, 'deliveryNotes'), where('signatureStatus', '==', 'pending'), where('readableBy', 'array-contains', currentUid));
      } catch (err) {
        logDebug('build readablePendingQuery failed', { message: err?.message });
        return null;
      }
    })();
    let assignedSnap = null, createdSnap = null, fallbackSnap = null;
    let emailSnap = null, readablePendingSnap = null;
    try { assignedSnap = await getDocs(assignedQuery); } catch (err) { logDebug('assigned query failed', { code: err.code, message: err.message }); }
    try { createdSnap = await getDocs(createdQuery); } catch (err) { logDebug('created query failed', { code: err.code, message: err.message }); }
    try { fallbackSnap = await getDocs(fallbackQuery); } catch (err) { logDebug('fallback query failed', { code: err.code, message: err.message }); }
    if (emailQuery) {
      try { emailSnap = await getDocs(emailQuery); } catch (err) { logDebug('email query failed', { code: err.code, message: err.message }); }
    }
    if (readablePendingQuery) {
      try { readablePendingSnap = await getDocs(readablePendingQuery); } catch (err) {
        logDebug('readablePending query failed', { code: err.code, message: err.message });
      }
    }

    const map = new Map();
    const mergeDocs = (snap) => {
      if (!snap) return;
      snap.forEach(doc => {
        map.set(doc.id, { id: doc.id, ...doc.data() });
      });
    };
    mergeDocs(assignedSnap);
    mergeDocs(createdSnap);
    mergeDocs(fallbackSnap);
    mergeDocs(emailSnap);
    mergeDocs(readablePendingSnap);
    let items = Array.from(map.values()).filter(item => (item.signatureStatus || 'pending') === 'pending');
    items.sort((a, b) => getTimestampValue(b.serverCreatedAt || b.createdAt) - getTimestampValue(a.serverCreatedAt || a.createdAt));
    if (items.length > 100) items = items.slice(0, 100);

    logDebug('pending count', { count: items.length });
    if (!isLatest()) return;

    if (items.length === 0 && pendingListEl.children.length === 0) {
      renderEmptyState();
    } else {
      const renderedDocIds = new Set();
      const renderedKeys = new Set();
      items.forEach(item => {
        if (!isLatest()) return;
        const key = item.id || item.localId;
        if (key && renderedKeys.has(key)) {
          logDebug('skip duplicate pending item', { key });
          return;
        }
        if (item.id && renderedDocIds.has(item.id)) {
          logDebug('skip duplicate docId', { docId: item.id });
          return;
        }
        if (item.id) renderedDocIds.add(item.id);
        if (key) renderedKeys.add(key);
        removeExistingPendingEntry({ docId: item.id, localId: item.localId });
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        li.dataset.docId = item.id;
        const date = (item.date || item.createdAt || '').toString().split('T')[0];
        li.innerHTML = `<div>
            <div class="fw-semibold">${item.customer || '-'} / ${item.location || '-'} </div>
            <div class="text-muted small">日期: ${date || '-'} · 金額: ${item.amount ? 'NT$ ' + item.amount : '-'} · 工時: ${item.totalHours ?? '-'}h</div>
          </div>
          <button class="btn btn-sm btn-outline-primary" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>`;
        li.addEventListener('click', (e) => {
          // 若點到內部按鈕也一樣載入
          const targetId = e.target.closest('button')?.getAttribute('data-id') || item.id;
          selectPending(targetId);
        });
        if (isLatest()) pendingListEl.appendChild(li);
      });
    }
  } catch (e) {
    // 理論上不會再進來；若進來一律以空清單結束，不再顯示紅色錯誤
    console.warn('[SignDebug] loadPendingList unexpected error suppressed', e);
    if (isLatest()) renderEmptyState();
  } finally {
    clearTimeout(to);
    if (!isLatest()) return;
    pendingLoadingEl.style.display = 'none';
    pendingListEl.style.display = 'block';
    if (timeoutHit) logDebug('timeout ended after fallback');
  }
}

// 啟用即時監聽：當 manager 建立新簽單或指派給司機時，司機端清單會立即更新
function startRealtimePending() {
  try {
    if (!currentUid) return; // 尚未取得使用者
    // 先取消舊監聽
    if (typeof unsubscribePendingRealtime === 'function') {
      unsubscribePendingRealtime();
      unsubscribePendingRealtime = null;
    }
    const base = collection(db, 'deliveryNotes');
    let q;
    if (currentRole === 'manager') {
      // 管理者：監聽所有待簽章（排序交給前端）
      q = query(base, where('signatureStatus', '==', 'pending'));
    } else {
      // 司機：僅監聽自己看得到的待簽章，避免需要 signatureStatus + readableBy 的複合索引
      q = query(base, where('readableBy', 'array-contains', currentUid), limit(200));
    }
    unsubscribePendingRealtime = onSnapshot(q, (snap) => {
      // 只有當實際有變化時才觸發重載，減少不必要的重新整理
      if (!snap || snap.docChanges().length === 0) return;
      try { loadPendingList(); } catch {}
    }, (err) => {
      console.warn('[SignDebug] realtime pending snapshot error', err?.message || err);
    });
    logDebug('realtime pending watcher started', { role: currentRole, uid: currentUid });
  } catch (e) {
    console.warn('[SignDebug] startRealtimePending failed', e);
  }
}

function selectPending(id) {
  selectHintEl?.classList.add('d-none');
  loadNote(id);
}

function renderNote(d) {
  currentNoteData = d ? { ...d } : null;
  noteSection.classList.remove('d-none');
  const date = (d.date || d.createdAt || '').toString().split('T')[0];
  const driverName = d.driverName || d.assignedDriverName || (Array.isArray(d.assignedDriverNames) ? d.assignedDriverNames.find(Boolean) : '') || d.createdByName || '-';
  const quantityText = formatQuantity(d.quantity);
  const itemText = d.item || d.purpose || '-';
  const machineText = getMachineLabel(d);
  noteBody.innerHTML = `
    <div class="row g-3 fs-6">
      <div class="col-sm-6 col-xl-4"><strong>日期:</strong> <span class="ms-1">${date || '-'}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>客戶:</strong> <span class="ms-1">${d.customer || '-'}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>地點:</strong> <span class="ms-1">${d.location || '-'}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>司機:</strong> <span class="ms-1">${driverName}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>車號:</strong> <span class="ms-1">${d.vehicleNumber || '-'}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>機具:</strong> <span class="ms-1">${machineText}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>金額:</strong> <span class="ms-1">${d.amount ? 'NT$ ' + d.amount : '-'}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>時間:</strong> <span class="ms-1">${(d.startTime || '') + (d.endTime ? ' ~ ' + d.endTime : '')}</span></div>
      <div class="col-sm-6 col-xl-4 d-flex align-items-center gap-2 flex-wrap"><strong class="mb-0">收款狀態:</strong><span id="paidStatusText" class="ms-1">${d.paidAt ? PAID_BADGE_HTML : UNPAID_BADGE_HTML}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>物品:</strong> <span class="ms-1">${itemText}</span></div>
      <div class="col-sm-6 col-xl-4"><strong>數量:</strong> <span class="ms-1">${quantityText}</span></div>
      <div class="col-12"><strong>作業狀況:</strong><br>${(d.work || '').replace(/\n/g,'<br>') || '-'}</div>
      <div class="col-12"><strong>備註:</strong><br>${(d.remark || '').replace(/\n/g,'<br>') || '-'}</div>
    </div>`;
  setStatusBadge(d.signatureStatus || 'pending');
  const isCompleted = (d.signatureStatus || (d.signatureDataUrl ? 'completed' : 'pending')) === 'completed';
    const shouldLock = !!d.paidAt || isCompleted;
    applyPaidState(!!d.paidAt, shouldLock);

  if (isCompleted && currentDocId && !currentNoteData?.machineUsageApplied) {
    const token = Symbol('usage-check');
    usageCheckInFlight = token;
    ensureUsageAppliedForDelivery({ docId: currentDocId, noteData: currentNoteData, reason: 'sign-delivery-view' })
      .then((result) => {
        if (usageCheckInFlight !== token) return;
        if (result && (result.applied || result.alreadyApplied)) {
          currentNoteData.machineUsageApplied = true;
          if (result.machineId && !currentNoteData.machineId) {
            currentNoteData.machineId = result.machineId;
          }
        }
      })
      .catch(err => console.warn('[SignDebug] ensure usage on view failed', err))
      .finally(() => {
        if (usageCheckInFlight === token) usageCheckInFlight = null;
      });
  }

  const imgSrc = d.signatureUrl || d.signatureDataUrl;
  if (d.signatureStatus === 'completed' && imgSrc) {
    showSignedPreview(imgSrc, d.signedAt);
  } else {
    showSignaturePad();
  }
}

function showSignaturePad() {
  signedPreview.classList.add('d-none');
  document.getElementById('signCard').classList.remove('d-none');
  initCanvas();
}

function showSignedPreview(dataUrl, signedAt) {
  document.getElementById('signCard').classList.add('d-none');
  signatureImg.src = dataUrl;
  signedAtText.textContent = '簽章時間：' + (signedAt?.toDate ? signedAt.toDate().toISOString() : (signedAt || ''));
  signedPreview.classList.remove('d-none');
}

function initCanvas() {
  if (!signaturePadCanvas) return;
  // 設定 touch-action 防止頁面滑動干擾簽名
  signaturePadCanvas.style.touchAction = 'none';

  // 依裝置像素比調整畫布尺寸，避免高 DPI 位移/鋸齒
  const rect = signaturePadCanvas.getBoundingClientRect();
  canvasDpr = Math.max(window.devicePixelRatio || 1, 1);
  canvasCssWidth = Math.max(1, Math.round(rect.width));
  canvasCssHeight = Math.max(1, Math.round(rect.height));
  signaturePadCanvas.style.width = `${canvasCssWidth}px`;
  signaturePadCanvas.style.height = `${canvasCssHeight}px`;
  signaturePadCanvas.width = Math.round(canvasCssWidth * canvasDpr);
  signaturePadCanvas.height = Math.round(canvasCssHeight * canvasDpr);

  ctx = signaturePadCanvas.getContext('2d');
  // 重設變換並依 DPR 縮放，讓座標以 CSS 像素為單位
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(canvasDpr, canvasDpr);

  // 畫布底色與畫筆
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvasCssWidth, canvasCssHeight);
  ctx.lineWidth = 2;            // 以 CSS 像素計
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#222';
  hasSignature = false;

  // 以 CSS 座標取得指標位置（已用 ctx.scale 處理 DPR）
  const getPos = (evt) => {
    // 優先使用 offsetX/Y（相對於目標元素，對縮放/滾動相容性佳）
    if (typeof evt.offsetX === 'number' && typeof evt.offsetY === 'number') {
      return { x: evt.offsetX, y: evt.offsetY };
    }
    const r = signaturePadCanvas.getBoundingClientRect();
    const t = evt.touches?.[0] || evt;
    const clientX = (typeof t.clientX === 'number') ? t.clientX : (t.x ?? 0);
    const clientY = (typeof t.clientY === 'number') ? t.clientY : (t.y ?? 0);
    return { x: clientX - r.left, y: clientY - r.top };
  };

  let drawing = false;
  let last = null;
  const start = (e) => {
    e.preventDefault();
    drawing = true;
    last = getPos(e);
    try { if (e.pointerId != null) signaturePadCanvas.setPointerCapture(e.pointerId); } catch {}
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasSignature = true;
    saveBtn.disabled = false;
  };
  const end = (e) => {
    drawing = false;
    if (e && e.pointerId != null) {
      try { signaturePadCanvas.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  // 以 Pointer Events 為主，回退 mouse/touch
  if ('onpointerdown' in window) {
    signaturePadCanvas.addEventListener('pointerdown', start, { passive: false });
    signaturePadCanvas.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, { passive: false });
  } else {
    signaturePadCanvas.onmousedown = start;
    signaturePadCanvas.onmousemove = move;
    window.onmouseup = end;
    signaturePadCanvas.ontouchstart = start;
    signaturePadCanvas.ontouchmove = move;
    window.ontouchend = end;
  }

  clearBtn.onclick = () => {
    // 清空畫布（CSS 像素空間）
    ctx.clearRect(0, 0, canvasCssWidth, canvasCssHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasCssWidth, canvasCssHeight);
    hasSignature = false;
    saveBtn.disabled = true;
  };
}

async function canvasToBlob(canvas) {
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.92));
}

async function deleteOldSignature(docId, oldPath) {
  if (!oldPath) return;
  try {
    await deleteObject(storageRef(storage, oldPath));
    logDebug('old signature deleted', { oldPath });
  } catch (e) {
    logDebug('delete old signature failed', { message: e.message });
  }
}

async function saveSignature() {
  if (!currentDocId && !currentLocalId) return;
  if (!hasSignature) {
    signatureError.classList.remove('d-none');
    return;
  }
  signatureError.classList.add('d-none');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>儲存中';
  try {
    if (currentDocId && navigator.onLine) {
      // 線上：上傳至 Storage 並更新文件
      let prev; try { prev = (await getDoc(doc(db,'deliveryNotes', currentDocId))).data(); } catch {}
      const referenceNote = prev || currentNoteData || {};
      const alreadyApplied = referenceNote?.machineUsageApplied === true;
      const shouldApplyMachineUsage = !alreadyApplied;
      const blob = await canvasToBlob(signaturePadCanvas);
      if (!blob) throw new Error('無法取得簽章影像');
      const filePath = `signatures/${currentDocId}_${Date.now()}.png`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, blob, { contentType: 'image/png' });
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'deliveryNotes', currentDocId), {
        signatureUrl: url,
        signatureStoragePath: filePath,
        signatureDataUrl: null,
        signedAt: serverTimestamp(),
        signatureStatus: 'completed',
        paidAt: receivedCashEl?.checked ? serverTimestamp() : null
      });
      if (shouldApplyMachineUsage) {
        const usageResult = await ensureUsageAppliedForDelivery({ docId: currentDocId, noteData: referenceNote, reason: 'sign-delivery-online' });
        if (usageResult && (usageResult.applied || usageResult.alreadyApplied)) {
          referenceNote.machineUsageApplied = true;
          if (usageResult.machineId && !referenceNote.machineId) {
            referenceNote.machineId = usageResult.machineId;
          }
          if (currentNoteData) {
            currentNoteData.machineUsageApplied = true;
            if (usageResult.machineId && !currentNoteData.machineId) {
              currentNoteData.machineId = usageResult.machineId;
            }
          }
        }
      }
      setStatusBadge('completed');
      const localSignedAt = new Date().toISOString();
      showSignedPreview(url, localSignedAt);
      if (currentNoteData) {
        currentNoteData.signatureStatus = 'completed';
        currentNoteData.signedAt = localSignedAt;
        if (receivedCashEl?.checked) {
          currentNoteData.paidAt = currentNoteData.paidAt || localSignedAt;
        }
      }
      if (prev?.signatureStoragePath && prev.signatureStoragePath !== filePath) {
        deleteOldSignature(currentDocId, prev.signatureStoragePath);
      }
      if (receivedCashEl?.checked) {
        applyPaidState(true, true);
      } else {
        updatePaidStatusLabel();
      }
    } else {
      // 離線：將 DataURL 暫存至離線簽單並加入簽章佇列
      const dataUrl = signaturePadCanvas.toDataURL('image/png');
      updateOfflineNoteSignature(currentLocalId, dataUrl, receivedCashEl?.checked === true);
      enqueueOfflineSignature({
        id: (crypto?.randomUUID?.() || (Date.now()+"_"+Math.random().toString(36).slice(2))),
        docId: null,
        localId: currentLocalId,
        localOnly: true,
        dataUrl,
        createdAt: new Date().toISOString(),
      });
      setStatusBadge('completed');
      const localOfflineSignedAt = new Date().toISOString();
      showSignedPreview(dataUrl, localOfflineSignedAt);
      if (currentNoteData) {
        currentNoteData.signatureStatus = 'completed';
        currentNoteData.signedAt = localOfflineSignedAt;
        if (receivedCashEl?.checked) {
          currentNoteData.paidAt = currentNoteData.paidAt || localOfflineSignedAt;
        }
      }
      if (receivedCashEl?.checked) {
        applyPaidState(true, true);
      } else {
        updatePaidStatusLabel();
      }
    }
  } catch (e) {
    alert('儲存失敗：' + e.message);
    saveBtn.disabled = false;
  } finally {
    saveBtn.innerHTML = '<i class="bi bi-pencil-square"></i> 完成簽章';
  }
}

redoSignature?.addEventListener('click', async () => {
  if (!currentDocId) return;
  const confirmRedo = confirm('重新簽章會覆蓋原有簽章，確定？');
  if (!confirmRedo) return;
  try {
    // 清除 firestore 欄位並刪除舊檔
    let prev; try { prev = (await getDoc(doc(db,'deliveryNotes', currentDocId))).data(); } catch {}
    if (prev?.signatureStoragePath) deleteOldSignature(currentDocId, prev.signatureStoragePath);
    await updateDoc(doc(db, 'deliveryNotes', currentDocId), {
      signatureUrl: null,
      signatureStoragePath: null,
      signatureDataUrl: null,
      signatureStatus: 'pending',
      signedAt: null
    });
    setStatusBadge('pending');
    showSignaturePad();
  } catch (e) {
    alert('切換回待簽章失敗：' + e.message);
  }
});

saveBtn.addEventListener('click', saveSignature);
reloadListBtn?.addEventListener('click', () => loadPendingList());
document.addEventListener('DOMContentLoaded', async () => {
  await waitForUserContext();
  loadPendingList();
  // 啟用即時監聽
  startRealtimePending();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) selectPending(id);
  logDebug('DOMContentLoaded done');
});

// 取得離線待簽清單（signatureStatus==pending）
function getOfflinePendingNotes() {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_NOTES_KEY) || '[]');
    const pending = list.filter(x => (x.signatureStatus || 'pending') === 'pending');
    pending.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    return pending;
  } catch { return []; }
}

function selectPendingOffline(localId) {
  selectHintEl?.classList.add('d-none');
  loadOfflineNote(localId);
}

function loadOfflineNote(localId) {
  logDebug('loadOfflineNote start', { localId });
  if (loadError) loadError.classList.add('d-none');
  noteSection.classList.add('d-none');
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_NOTES_KEY) || '[]');
    const data = list.find(x => x.localId === localId);
    if (!data) {
      if (loadError) {
        loadError.textContent = '找不到此離線簽單';
        loadError.classList.remove('d-none');
      }
      return;
    }
    currentDocId = null;
    currentLocalId = localId;
    renderNote(data);
  } catch (e) {
    logDebug('loadOfflineNote error', { message: e.message });
    if (loadError) {
      loadError.textContent = '載入離線簽單失敗：' + e.message;
      loadError.classList.remove('d-none');
    }
  }
}

function enqueueOfflineSignature(item) {
  try {
    const list = JSON.parse(localStorage.getItem(SIG_QUEUE_KEY) || '[]');
    list.push(item);
    localStorage.setItem(SIG_QUEUE_KEY, JSON.stringify(list));
    logDebug('offline signature enqueued', { id: item.id, localId: item.localId });
  } catch (e) {
    logDebug('enqueue offline signature failed', { message: e.message });
  }
}

function updateOfflineNoteSignature(localId, dataUrl, receivedCash = false) {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_NOTES_KEY) || '[]');
    const idx = list.findIndex(x => x.localId === localId);
    if (idx >= 0) {
      list[idx].signatureStatus = 'completed';
      list[idx].signatureDataUrl = dataUrl;
      list[idx].signedAt = new Date().toISOString();
      list[idx].paidAt = receivedCash ? new Date().toISOString() : null;
      localStorage.setItem(OFFLINE_NOTES_KEY, JSON.stringify(list));
      logDebug('offline note updated with signature', { localId });
    }
  } catch (e) {
    logDebug('update offline note signature failed', { message: e.message });
  }
}

// 方案A：即時注入最新離線 pending 簽單到清單頂部（黃色）
function injectLatestOffline() {
  const latest = getOfflinePendingNotes();
  if (!Array.isArray(latest) || latest.length === 0) return;

  if (navigator.onLine) return; // 僅離線模式顯示

  // 建立現有清單鍵集合，避免重覆插入
  const existingKeys = new Set();
  pendingListEl.querySelectorAll('li').forEach(li => {
    const btn = li.querySelector('button');
    if (!btn) return;
    const key = btn.getAttribute('data-local-id') || btn.getAttribute('data-id');
    if (key) existingKeys.add(key);
  });

  let injected = 0;
  latest.forEach(item => {
    const key = item.localId;
    if (!key || existingKeys.has(key)) return; // 已存在不重覆插入

    removeExistingPendingEntry({ docId: item.id, localId: item.localId });
    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center list-group-item-warning';
    li.dataset.localId = item.localId;
    const date = (item.date || item.createdAt || '').toString().split('T')[0];
    li.innerHTML = `<div>
        <div class="fw-semibold">${item.customer || '-'} / ${item.location || '-'} <span class="badge bg-warning text-dark ms-1">離線</span></div>
        <div class="text-muted small">日期: ${date || '-'} · 金額: ${item.amount ? 'NT$ ' + item.amount : '-'} · 工時: ${item.totalHours ?? '-'}h</div>
      </div>
      <button class="btn btn-sm btn-outline-primary" data-local-id="${item.localId}"><i class="bi bi-pencil-square"></i></button>`;

    li.addEventListener('click', (e) => {
      const lid = e.target.closest('button')?.getAttribute('data-local-id') || item.localId;
      selectPendingOffline(lid);
    });

    pendingListEl.insertBefore(li, pendingListEl.firstChild);
    existingKeys.add(key);
    injected++;
  });

  if (injected > 0) {
    pendingLoadingEl.style.display = 'none';
    noPendingEl.classList.add('d-none');
    pendingListEl.style.display = 'block';
    logDebug('injectLatestOffline injected', { injected });
  }
}

// 事件驅動：離線筆數變更或 storage 變更時即時插入
window.addEventListener('offline-count-changed', () => {
  logDebug('offline-count-changed event received');
  if (!navigator.onLine) {
    try { injectLatestOffline(); } catch { loadPendingList(); }
  } else {
    clearOfflineInjectedRows();
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === OFFLINE_NOTES_KEY) {
    logDebug('storage event: offline notes changed');
    if (!navigator.onLine) {
      try { injectLatestOffline(); } catch { loadPendingList(); }
    } else {
      clearOfflineInjectedRows();
    }
  }
});
