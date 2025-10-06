// sign-delivery.js - 單獨簽章頁面
import { db } from '../firebase-init.js';
import { offlineManager } from './offline.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

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
const netStatusAlert = document.getElementById('netStatusAlert');

// 離線簽章佇列 key
const OFFLINE_SIGNATURE_KEY = 'offline_signatures_queue';
const PENDING_CACHE_KEY = 'cached_pending_sign_docs';

function readOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_SIGNATURE_KEY)||'[]'); } catch { return []; }
}
function writeOfflineQueue(arr) { localStorage.setItem(OFFLINE_SIGNATURE_KEY, JSON.stringify(arr)); }
async function syncOfflineSignatures() {
  const list = readOfflineQueue();
  if (!navigator.onLine || list.length === 0) return;
  logDebug('try sync offline signatures', { count: list.length });
  for (const item of list) {
    try {
      await updateDoc(doc(db, 'deliveryNotes', item.docId), {
        signatureDataUrl: item.dataUrl,
        signedAt: serverTimestamp(),
        signatureStatus: 'completed'
      });
      logDebug('offline signature synced', { docId: item.docId });
      // 移除成功項目
      const remain = readOfflineQueue().filter(x => x.id !== item.id);
      writeOfflineQueue(remain);
    } catch (e) {
      logDebug('offline signature sync failed', { docId: item.docId, error: e.message });
      // 若失敗保留，稍後再試
    }
  }
  // 若有目前載入的文件剛好被同步，更新畫面
  if (currentDocId) loadNote(currentDocId);
}

let currentDocId = null;
let hasSignature = false;
let ctx;

function logDebug(msg, data) {
  const ts = new Date().toISOString().split('T')[1].replace('Z','');
  if (debugLogEl) {
    debugLogEl.textContent += `[#${ts}] ${msg}` + (data ? ` => ${JSON.stringify(data)}` : '') + "\n";
  }
  console.log('[SignDebug]', msg, data||'');
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
  // 先檢查是否為本地離線 localId
  const offlineMatch = offlineManager.getOfflineData().find(n => n.localId === id);
  if (offlineMatch) {
    logDebug('load offline local note', { localId: id });
    // 離線筆尚未有真正 doc id，因此簽章時需阻擋或暫存
    renderNote({ ...offlineMatch, _isLocalOnly: true });
    return;
  }
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
  logDebug('loadPendingList start');
  pendingListEl.style.display = 'none';
  pendingLoadingEl.style.display = 'block';
  noPendingEl.classList.add('d-none');
  pendingListEl.innerHTML = '';
  let timeoutHit = false;
  const to = setTimeout(() => {
    timeoutHit = true;
    logDebug('pendingList timeout fallback triggered (5s)');
    pendingLoadingEl.innerHTML = '<span class="text-warning small">載入逾時，嘗試較簡單查詢...</span>';
  }, 5000);
  // 若離線，直接用快取 + 離線本地簽單
  if (!navigator.onLine) {
    logDebug('offline pending list using cache');
    const cache = (()=>{try{return JSON.parse(localStorage.getItem(PENDING_CACHE_KEY)||'[]')}catch{return []}})();
    const offlineNotes = (window.offlineManager?.getOfflineData()||[]).filter(n=> (n.signatureStatus||'pending')==='pending');
    const mergedMap = new Map();
    [...cache, ...offlineNotes].forEach(item=>{
      const key = item.id || item.localId || item.docId || item.tempId || item.createdAt;
      if(!mergedMap.has(key)) mergedMap.set(key,item);
    });
    const items = [...mergedMap.values()];
    if (items.length===0) noPendingEl.classList.remove('d-none');
    else renderPendingItems(items, { fromCache: true });
    pendingLoadingEl.style.display='none';
    pendingListEl.style.display='block';
    return;
  }
  try {
    // 取最新 100 筆待簽章 (可調整)
    const q = query(
      collection(db, 'deliveryNotes'),
      where('signatureStatus', '==', 'pending'),
      orderBy('serverCreatedAt', 'desc'),
      limit(100)
    );
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err) {
      logDebug('primary query failed', { code: err.code, message: err.message });
      // 可能是沒有建立複合索引 或 serverCreatedAt 尚未存在 → 改用較寬鬆查詢 (僅 where)
      const q2 = query(
        collection(db, 'deliveryNotes'),
        where('signatureStatus', '==', 'pending'),
        limit(100)
      );
      snap = await getDocs(q2);
      logDebug('fallback query used');
    }
    const items = [];
    snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    // 快取線上結果（僅基本欄位）
    try { localStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(items.slice(0,100))); } catch {}
    logDebug('pending count', { count: items.length });
    if (items.length === 0) {
      noPendingEl.classList.remove('d-none');
    } else {
      renderPendingItems(items, { fromCache: false });
    }
  } catch (e) {
    console.error(e);
    logDebug('loadPendingList error', { message: e.message, code: e.code });
    pendingListEl.innerHTML = `<li class="list-group-item text-danger">載入失敗：${e.message}</li>`;
  } finally {
    clearTimeout(to);
    pendingLoadingEl.style.display = 'none';
    pendingListEl.style.display = 'block';
    if (timeoutHit) logDebug('timeout ended after fallback');
  }
}

function renderPendingItems(items, { fromCache }) {
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
    const date = (item.date || item.createdAt || '').toString().split('T')[0];
    const badges = [];
    if (fromCache) badges.push('<span class="badge bg-secondary ms-1">快取</span>');
    if (item.offline) badges.push('<span class="badge bg-warning text-dark ms-1">離線</span>');
    li.innerHTML = `<div>
        <div class="fw-semibold">${item.customer || '-'} / ${item.location || '-'} ${badges.join('')}</div>
        <div class="text-muted small">日期: ${date || '-'} · 金額: ${item.amount ? 'NT$ ' + item.amount : '-'} · 工時: ${item.totalHours ?? '-'}h</div>
      </div>
      <button class="btn btn-sm btn-outline-primary" data-id="${item.id || item.localId}"><i class="bi bi-pencil-square"></i></button>`;
    li.addEventListener('click', (e) => {
      const targetId = e.target.closest('button')?.getAttribute('data-id') || item.id || item.localId;
      selectPending(targetId);
    });
    pendingListEl.appendChild(li);
  });
}

function selectPending(id) {
  selectHintEl?.classList.add('d-none');
  loadNote(id);
}

function renderNote(d) {
  noteSection.classList.remove('d-none');
  const date = (d.date || d.createdAt || '').toString().split('T')[0];
  const localWarn = d._isLocalOnly ? '<div class="alert alert-warning py-1 px-2 small mb-2"><i class="bi bi-exclamation-triangle me-1"></i> 此簽單尚未上傳，需上線後才能正式存入並附加簽章。</div>' : '';
  noteBody.innerHTML = `
    ${localWarn}
    <div class="row g-2 small">
      <div class="col-md-4"><strong>日期:</strong> ${date || '-'}</div>
      <div class="col-md-4"><strong>客戶:</strong> ${d.customer || '-'}</div>
      <div class="col-md-4"><strong>地點:</strong> ${d.location || '-'}</div>
      <div class="col-md-12"><strong>作業狀況:</strong><br>${(d.work || '').replace(/\n/g,'<br>') || '-'}</div>
      <div class="col-md-4"><strong>時間:</strong> ${(d.startTime||'') + (d.endTime?(' ~ '+d.endTime):'')}</div>
      <div class="col-md-4"><strong>金額:</strong> ${d.amount? 'NT$ '+d.amount : '-'}</div>
      <div class="col-md-4"><strong>機具:</strong> ${d.machine||'-'}</div>
      <div class="col-md-4"><strong>車號:</strong> ${d.vehicleNumber||'-'}</div>
      <div class="col-md-4"><strong>司機:</strong> ${d.driverName||'-'}</div>
      <div class="col-md-12"><strong>備註:</strong> ${(d.remark||'').replace(/\n/g,'<br>')||'-'}</div>
    </div>`;
  setStatusBadge(d.signatureStatus || 'pending');

  if (d._isLocalOnly) {
    // 本地尚未上傳：允許先畫簽章，但需暫存於本地並等待該筆上傳後再補寫入
    showSignaturePad();
  } else if (d.signatureStatus === 'completed' && d.signatureDataUrl) {
    showSignedPreview(d.signatureDataUrl, d.signedAt);
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
  ctx = signaturePadCanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,signaturePadCanvas.width, signaturePadCanvas.height);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#222';
  hasSignature = false;

  const getPos = (evt) => {
    const rect = signaturePadCanvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  let drawing = false;
  let last = null;
  const start = (e) => {
    e.preventDefault();
    drawing = true;
    last = getPos(e);
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
  const end = () => { drawing = false; };

  signaturePadCanvas.onmousedown = start;
  signaturePadCanvas.onmousemove = move;
  window.onmouseup = end;
  signaturePadCanvas.ontouchstart = start;
  signaturePadCanvas.ontouchmove = move;
  window.ontouchend = end;

  clearBtn.onclick = () => {
    ctx.clearRect(0,0,signaturePadCanvas.width, signaturePadCanvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,signaturePadCanvas.width, signaturePadCanvas.height);
    hasSignature = false;
    saveBtn.disabled = true;
  };
}

async function saveSignature() {
  if (!currentDocId) return;
  if (!hasSignature) {
    signatureError.classList.remove('d-none');
    return;
  }
  signatureError.classList.add('d-none');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>儲存中';
  try {
    const dataUrl = signaturePadCanvas.toDataURL('image/png');
    // 判斷目前顯示的是否為本地離線未上傳資料
    const localOnly = !!noteBody.querySelector('.alert-warning');
    if (localOnly) {
      // 將簽章暫存在離線簽章陣列，需等該 localId 上傳成真正 doc 後再匹配補上
      const localId = offlineManager.getOfflineData().find(n=> n.localId === currentDocId)?.localId || currentDocId;
      const pendingLocal = readOfflineQueue();
      pendingLocal.push({ id: crypto.randomUUID(), docId: null, localId, dataUrl, createdAt: Date.now(), localOnly: true });
      writeOfflineQueue(pendingLocal);
      alert('離線本地簽單：簽章已暫存。此筆上傳後會自動套用。');
      setStatusBadge('pending');
      showSignedPreview(dataUrl, new Date().toISOString());
    } else if (!navigator.onLine) {
      // 離線：推入佇列 (已有 docId)
      const q = readOfflineQueue();
      q.push({ id: crypto.randomUUID(), docId: currentDocId, dataUrl, createdAt: Date.now() });
      writeOfflineQueue(q);
      alert('離線中：簽章已暫存，重新上線會自動同步。');
      setStatusBadge('pending');
      showSignedPreview(dataUrl, new Date().toISOString());
    } else {
      await updateDoc(doc(db, 'deliveryNotes', currentDocId), {
        signatureDataUrl: dataUrl,
        signedAt: serverTimestamp(),
        signatureStatus: 'completed'
      });
      setStatusBadge('completed');
      showSignedPreview(dataUrl, new Date().toISOString());
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
    await updateDoc(doc(db, 'deliveryNotes', currentDocId), {
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

document.addEventListener('DOMContentLoaded', () => {
  loadPendingList();
  // URL 若帶 id 仍可直接載入（例如分享連結）
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) selectPending(id);
  logDebug('DOMContentLoaded done');
  // 初始網路狀態
  if (!navigator.onLine) {
    netStatusAlert?.classList.remove('d-none');
  }
  window.addEventListener('online', () => {
    netStatusAlert?.classList.add('d-none');
    syncOfflineSignatures();
  });
  window.addEventListener('offline', () => {
    netStatusAlert?.classList.remove('d-none');
  });
  // 嘗試背景同步現有離線簽章
  syncOfflineSignatures();
});
