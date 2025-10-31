// history.js - 讀取簽單歷史 + 搜尋 + 分頁 + 詳情 (含離線未同步資料顯示)
import { listHistoryDeliveries, getApiSource } from './api/index.js';
import { db } from '../firebase-init.js';
import { collection, query, orderBy, where, limit as qlimit, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { getUserContext, onUserRoleReady } from './session-context.js';
import { offlineManager } from './offline.js';

console.log('📜 history.js 已載入，來源=', getApiSource());

const tbody = document.getElementById('historyTable');
const searchCustomer = document.getElementById('searchCustomer');
const searchDate = document.getElementById('searchDate');
const paginationEl = document.getElementById('pagination');
const offlineStatusEl = document.getElementById('offlineStatus');

const PAGE_SIZE = 10;
let allData = []; // 原始 (含線上 + 離線)
let filtered = []; // 搜尋結果
let currentPage = 1;

// API 已回傳可直接使用的物件（mock/Firestore 已各自處理時間欄位）

function formatDate(iso) {
  if (!iso) return '-';
  try { return iso.split('T')[0]; } catch { return iso; }
}

function formatTimeRange(item) {
  if (!item.startTime && !item.endTime) return '-';
  return `${item.startTime || ''}${item.endTime ? ' ~ ' + item.endTime : ''}`;
}

function formatQuantity(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function getItemDisplay(item) {
  const value = item.item || item.purpose;
  if (!value) return '-';
  const text = String(value).trim();
  return text || '-';
}

function getDriverDisplay(item) {
  const pick = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = pick(entry);
        if (text) return text;
      }
      return '';
    }
    if (typeof value === 'object') {
      const name = value.displayName || value.name || value.label;
      if (name) return String(name).trim();
      return '';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed;
    }
    return String(value).trim();
  };
  const candidates = [
    item.driverName,
    item.assignedDriverName,
    item.assignedDriverNames,
    item.assignedDrivers,
    item.createdByName,
    item.assignedDriverEmail,
    item.createdByEmail
  ];
  for (const candidate of candidates) {
    const text = pick(candidate);
    if (text) return text;
  }
  return '-';
}

function getMachineDisplay(item) {
  const isPlaceholder = (text) => typeof text === 'string' && /選擇機具/.test(text);
  const pick = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = pick(entry);
        if (text) {
          if (isPlaceholder(text)) return '';
          return text;
        }
      }
      return '';
    }
    if (typeof value === 'object') {
      const name = value.modelName || value.displayName || value.name || value.label || value.title;
      if (name) {
        const text = String(name).trim();
        if (isPlaceholder(text)) return '';
        return text;
      }
      return '';
    }
    if (typeof value === 'string') {
      const text = value.trim();
      if (isPlaceholder(text)) return '';
      return text;
    }
    const text = String(value).trim();
    if (isPlaceholder(text)) return '';
    return text;
  };
  const candidates = [
    item.machineName,
    item.modelName,
    item.machineModel,
    item.machine,
    item.machines,
    item.machineId
  ];
  for (const candidate of candidates) {
    const text = pick(candidate);
    if (text) return text;
  }
  return '-';
}

function getVehicleDisplay(item) {
  const visit = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = visit(entry);
        if (text) return text;
      }
      return '';
    }
    if (typeof value === 'object') {
      const keys = ['vehicleNumber', 'number', 'plate', 'display', 'label', 'value'];
      for (const key of keys) {
        if (value[key]) {
          const inner = visit(value[key]);
          if (inner) return inner;
        }
      }
      return '';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed;
    }
    return String(value).trim();
  };

  const candidates = [
    item.vehicleNumber,
    item.vehicle,
    item.vehicleInfo,
    item.vehiclePlate,
    item.vehicleNo
  ];
  for (const candidate of candidates) {
    const text = visit(candidate);
    if (text) return text;
  }
  return '-';
}

function applyFilter() {
  const c = searchCustomer.value.trim().toLowerCase();
  const d = searchDate.value.trim();
  filtered = allData.filter(item => {
    const matchCustomer = !c || (item.customer || '').toLowerCase().includes(c);
    const matchDate = !d || formatDate(item.date || item.createdAt) === d;
    return matchCustomer && matchDate;
  });
  currentPage = 1;
  render();
}

function renderPagination() {
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  paginationEl.innerHTML = '';
  const createBtn = (page, label = page, active = false) => {
    const li = document.createElement('li');
    li.className = 'page-item' + (active ? ' active' : '');
    const a = document.createElement('button');
    a.className = 'page-link';
    a.textContent = label;
    a.addEventListener('click', () => { currentPage = page; renderTable(); renderPagination(); });
    li.appendChild(a);
    return li;
  };
  for (let p = 1; p <= totalPages; p++) paginationEl.appendChild(createBtn(p, p, p === currentPage));
}

function renderTable() {
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  if (pageItems.length === 0) {
    const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" class="text-center text-muted py-4">無符合資料</td>`;
    tbody.appendChild(tr);
    return;
  }
  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    if (item.offline) tr.classList.add('table-warning');
    const sigStatus = item.signatureStatus || (item.signatureDataUrl ? 'completed' : 'pending');
    const sigBadge = sigStatus === 'completed'
      ? '<span class="badge bg-success">已簽</span>'
      : '<span class="badge bg-warning text-dark">待簽</span>';
    const driverName = getDriverDisplay(item);
    tr.innerHTML = `
      <td title="${item.offline ? '離線暫存尚未同步' : ''}">${driverName}</td>
      <td>${formatDate(item.date || item.createdAt)}</td>
      <td>${item.customer || '-'}</td>
      <td>${item.location || '-'}</td>
      <td>${item.amount ? 'NT$ ' + item.amount : '-'}</td>
      <td>${sigBadge}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" data-id="${item.id || item.localId}" data-local="${!!item.offline}"><i class="bi bi-eye"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function render() { renderTable(); renderPagination(); }

// 更新離線狀態顯示
function updateOfflineStatus(state) {
  if (!offlineStatusEl) return;
  // state = { mode: 'idle'|'syncing'|'error', count, extra? }
  const { mode = 'idle', count = 0 } = state || {};
  let html = '';
  if (mode === 'syncing') {
    html = `<span class="text-primary"><span class="spinner-border spinner-border-sm me-1"></span>同步中 (${count} 筆)...</span>`;
  } else if (mode === 'error') {
    html = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>同步失敗，稍後將再嘗試</span>`;
  } else {
    if (count > 0) html = `<span class="text-warning"><i class="bi bi-cloud-off me-1"></i>${count} 筆離線未同步</span>`;
    else html = `<span class="text-success"><i class="bi bi-cloud-check me-1"></i>無離線待同步資料</span>`;
  }
  offlineStatusEl.innerHTML = html;
}

// 詳情 Modal
const detailModalEl = document.getElementById('detailModal');
const detailBody = detailModalEl?.querySelector('.modal-body');
const detailSyncInfo = detailModalEl?.querySelector('#detailSyncInfo');
let detailModal;
if (detailModalEl && window.bootstrap) {
  detailModal = new bootstrap.Modal(detailModalEl);
}

tbody?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const item = allData.find(x => (x.id || x.localId) == id);
  if (!item) return;
  const driverName = getDriverDisplay(item);
  const quantityText = formatQuantity(item.quantity);
  const itemText = getItemDisplay(item);
  const machineText = getMachineDisplay(item);
  const vehicleText = getVehicleDisplay(item);
  const paidBadge = item.paidAt
    ? '<span class="badge bg-success"><i class="bi bi-cash-coin me-1"></i>已收款</span>'
    : '<span class="badge bg-secondary"><i class="bi bi-clock-history me-1"></i>待收款</span>';
  const signatureBadge = ((item.signatureStatus || (item.signatureDataUrl ? 'completed' : 'pending')) === 'completed')
    ? '<span class="badge bg-success">已簽章</span>'
    : '<span class="badge bg-warning text-dark">待簽章</span>';
  const syncBadge = item.offline
    ? '<span class="badge bg-warning text-dark">離線暫存</span>'
    : '<span class="badge bg-success">已同步</span>';
  const detailLink = itemText;
  if (detailSyncInfo) {
    detailSyncInfo.innerHTML = syncBadge;
    detailSyncInfo.classList.toggle('d-none', !syncBadge);
  }
  detailBody.innerHTML = `
    <div class="row g-3 align-items-start">
      <div class="col-sm-6 col-lg-4"><strong>日期:</strong> <span class="ms-1">${formatDate(item.date || item.createdAt)}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>客戶:</strong> <span class="ms-1">${item.customer || '-'}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>地點:</strong> <span class="ms-1">${item.location || '-'}</span></div>

      <div class="col-sm-6 col-lg-4"><strong>司機:</strong> <span class="ms-1">${driverName}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>金額:</strong> <span class="ms-1">${item.amount ? 'NT$ ' + item.amount : '-'}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>時間:</strong> <span class="ms-1">${formatTimeRange(item)}</span></div>

      <div class="col-sm-6 col-lg-4"><strong>物品:</strong> <span class="ms-1">${detailLink}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>數量:</strong> <span class="ms-1">${quantityText}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>機具:</strong> <span class="ms-1">${machineText}</span></div>
      <div class="col-sm-6 col-lg-4"><strong>車號:</strong> <span class="ms-1">${vehicleText}</span></div>
      <div class="col-sm-6 col-lg-4 d-flex align-items-center gap-2 flex-wrap"><strong class="mb-0">簽章狀態:</strong><span class="ms-1">${signatureBadge}</span></div>

      <div class="col-sm-6 col-lg-4 d-flex align-items-center gap-2 flex-wrap"><strong class="mb-0">收款狀態:</strong><span class="ms-1">${paidBadge}</span></div>

      <div class="col-12"><strong>作業狀況:</strong><br>${(item.work || '').replace(/\n/g,'<br>') || '-'}</div>
      <div class="col-12"><strong>備註:</strong><br>${(item.remark||'').replace(/\n/g,'<br>')||'-'}</div>
    </div>`;
  detailModal?.show();
});

searchCustomer?.addEventListener('input', () => applyFilter());
searchDate?.addEventListener('change', () => applyFilter());

async function loadData() {
  const data = [];
  try {
    const rows = await listHistoryDeliveries(200);
    rows.forEach(item => data.push(item));
  } catch (e) {
    console.warn('讀取線上/Mock 資料失敗，僅顯示離線暫存', e);
  }
  // 加入尚未同步的離線資料 (localStorage)
  const offline = offlineManager.getOfflineData();
  // 用 localId 當 key 判斷是否已存在 (理論上不會)
  const existingLocalIds = new Set(data.map(d => d.localId));
  offline.forEach(o => { if (!existingLocalIds.has(o.localId)) data.unshift(o); }); // 未同步放最前面

  allData = data;
  filtered = [...allData];
  render();
}

loadData();
// 啟用即時監聽（Firestore 模式時） —— 當 deliveryNotes 有變更時重新載入資料
let unsubscribeHistoryFns = [];
async function startRealtimeHistory() {
  try {
    if (getApiSource() !== 'firestore') return;
    // 取消既有監聽
    if (Array.isArray(unsubscribeHistoryFns)) {
      unsubscribeHistoryFns.forEach(fn => { try { fn(); } catch {} });
    }
    unsubscribeHistoryFns = [];

    const { uid, role } = await getUserContext();
    const base = collection(db, 'deliveryNotes');

    if (role === 'manager') {
      try {
        const q = query(base, orderBy('serverCreatedAt', 'desc'), qlimit(200));
        const unsub = onSnapshot(q, (snap) => {
          if (!snap || snap.docChanges().length === 0) return;
          // 有變化就重新載入（避免複雜的合併邏輯）
          loadData();
        }, (err) => console.warn('[History] realtime snapshot error', err));
        unsubscribeHistoryFns.push(unsub);
      } catch (e) {
        console.warn('[History] manager realtime setup failed', e);
      }
    } else {
      // 非管理者：監聽使用者可見或被指派的文件
      try {
        const q1 = query(base, where('readableBy', 'array-contains', uid), qlimit(200));
        unsubscribeHistoryFns.push(onSnapshot(q1, (snap) => { if (snap && snap.docChanges().length) loadData(); }, (err) => console.warn('[History] realtime readableBy error', err)));
      } catch (e) { /* ignore */ }
      try {
        const q2 = query(base, where('assignedTo', 'array-contains', uid), qlimit(200));
        unsubscribeHistoryFns.push(onSnapshot(q2, (snap) => { if (snap && snap.docChanges().length) loadData(); }, (err) => console.warn('[History] realtime assignedTo error', err)));
      } catch (e) { /* ignore */ }
      try {
        const q3 = query(base, where('createdBy', '==', uid), qlimit(200));
        unsubscribeHistoryFns.push(onSnapshot(q3, (snap) => { if (snap && snap.docChanges().length) loadData(); }, (err) => console.warn('[History] realtime createdBy error', err)));
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.warn('[History] startRealtimeHistory failed', e);
  }
}

// 當使用者角色就緒或變更時重啟監聽
onUserRoleReady(() => {
  try { startRealtimeHistory(); } catch (e) { console.warn('[History] startRealtimeHistory trigger failed', e); }
});

// 在頁面載入後建立監聽（若 session-context 已就緒則會立即生效）
startRealtimeHistory();

// 卸載時取消監聽
window.addEventListener('beforeunload', () => {
  if (Array.isArray(unsubscribeHistoryFns)) unsubscribeHistoryFns.forEach(fn => { try { fn(); } catch {} });
});
// 監聽離線同步事件，完成或失敗後重新載入
window.addEventListener('offline-sync-done', (e) => {
  if (e?.detail?.count) console.log(`[History] 離線同步完成 ${e.detail.count} 筆`);
  loadData();
  // 同步後更新離線筆數（可能已被清空）
  window.dispatchEvent(new CustomEvent('offline-count-refresh-request'));
  updateOfflineStatus({ mode: 'idle', count: lastOfflineCount });
});
window.addEventListener('offline-sync-start', (e) => {
  console.log(`[History] 離線同步開始，${e.detail.count} 筆`);
  updateOfflineStatus({ mode: 'syncing', count: e.detail.count });
});
window.addEventListener('offline-sync-error', (e) => {
  console.warn('[History] 離線同步失敗', e.detail);
  updateOfflineStatus({ mode: 'error', count: lastOfflineCount });
});

let lastOfflineCount = 0;
window.addEventListener('offline-count-changed', (e) => {
  lastOfflineCount = e.detail.count;
  // 若不是同步中才更新顯示（同步中時由 sync-start 決定）
  updateOfflineStatus({ mode: 'idle', count: lastOfflineCount });
});

// 初始顯示（若 offline.js 先派事件會再覆蓋）
updateOfflineStatus({ mode: 'idle', count: 0 });
// 原本 online 事件延遲刷新改為：online 只觸發同步 (由 offline.js 處理)，歷史頁只聽 sync 結果