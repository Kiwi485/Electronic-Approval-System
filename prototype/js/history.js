// history.js - 讀取簽單歷史 + 搜尋 + 分頁 + 詳情 (含離線未同步資料顯示)
import { db } from './firebase-init.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';

console.log('📜 history.js 已載入');

const tbody = document.getElementById('historyTable');
const searchCustomer = document.getElementById('searchCustomer');
const searchDate = document.getElementById('searchDate');
const paginationEl = document.getElementById('pagination');
const offlineStatusEl = document.getElementById('offlineStatus');

const PAGE_SIZE = 10;
let allData = []; // 原始 (含線上 + 離線)
let filtered = []; // 搜尋結果
let currentPage = 1;

function normalizeDoc(doc) {
  const d = doc.data();
  // Firestore Timestamp 處理 (serverCreatedAt 或 createdAt 任一)
  let createdAt = d.createdAt;
  if (d.serverCreatedAt?.toDate) createdAt = d.serverCreatedAt.toDate().toISOString();
  else if (d.createdAt?.toDate) createdAt = d.createdAt.toDate().toISOString();
  return { id: doc.id, ...d, createdAt };
}

function formatDate(iso) {
  if (!iso) return '-';
  try { return iso.split('T')[0]; } catch { return iso; }
}

function formatTimeRange(item) {
  if (!item.startTime && !item.endTime) return '-';
  return `${item.startTime || ''}${item.endTime ? ' ~ ' + item.endTime : ''}`;
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
    tr.innerHTML = `
      <td title="${item.offline ? '離線暫存尚未同步' : ''}">${item.id || item.localId || '-'}</td>
      <td>${formatDate(item.date || item.createdAt)}</td>
      <td>${item.customer || '-'}</td>
      <td>${item.location || '-'}</td>
      <td>${item.amount ? 'NT$ ' + item.amount : '-'}</td>
      <td>${formatTimeRange(item)}</td>
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
  detailBody.innerHTML = `
    <div class="row g-2">
      <div class="col-6"><strong>日期:</strong> ${formatDate(item.date || item.createdAt)}</div>
      <div class="col-6"><strong>客戶:</strong> ${item.customer || '-'}</div>
      <div class="col-12"><strong>地點:</strong> ${item.location || '-'}</div>
      <div class="col-12"><strong>作業狀況:</strong><br>${(item.work || '').replace(/\n/g,'<br>') || '-'}</div>
      <div class="col-6"><strong>時間:</strong> ${formatTimeRange(item)}</div>
      <div class="col-6"><strong>金額:</strong> ${item.amount ? 'NT$ ' + item.amount : '-'}</div>
      <div class="col-6"><strong>LocalId:</strong> ${item.localId || '-'}</div>
      <div class="col-6"><strong>狀態:</strong> ${item.offline ? '<span class="badge bg-warning text-dark">離線暫存</span>' : '<span class="badge bg-success">已同步</span>'}</div>
    </div>`;
  detailModal?.show();
});

searchCustomer?.addEventListener('input', () => applyFilter());
searchDate?.addEventListener('change', () => applyFilter());

async function loadData() {
  const data = [];
  try {
    const q = query(collection(db, 'deliveryNotes'), orderBy('serverCreatedAt', 'desc'));
    const snap = await getDocs(q);
    snap.forEach(doc => data.push(normalizeDoc(doc)));
  } catch (e) {
    console.warn('讀取線上資料失敗，僅顯示離線暫存', e);
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
