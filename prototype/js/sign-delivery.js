// sign-delivery.js - 單獨簽章頁面
import { db } from '../firebase-init.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js';
import { storage } from '../firebase-init.js';
import { listPendingDeliveries } from './api/index.js';

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

let currentDocId = null;        // 線上文件 id
let currentLocalId = null;      // 離線暫存 id
let hasSignature = false;
let ctx;

function logDebug(msg, data) {
  const ts = new Date().toISOString().split('T')[1]?.replace('Z','') || '';
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

const toIsoString = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const normalizeNote = (raw) => {
  if (!raw) return null;
  const id = raw.id || raw.docId || raw.localId;
  if (!id) return null;
  const data = { ...raw, id };
  data.serverCreatedAt = toIsoString(raw.serverCreatedAt);
  data.createdAt = toIsoString(raw.createdAt);
  data.signedAt = toIsoString(raw.signedAt);
  return data;
};

const sortByNewest = (a, b) => {
  const getTime = (item) => new Date(item?.serverCreatedAt || item?.createdAt || 0).getTime();
  return getTime(b) - getTime(a);
};

async function loadPendingList() {
  logDebug('loadPendingList start');
  if (!pendingListEl) return;
  pendingListEl.innerHTML = '';
  pendingListEl.style.display = 'none';
  pendingLoadingEl?.classList.remove('d-none');
  if (pendingLoadingEl) pendingLoadingEl.style.display = 'block';
  noPendingEl?.classList.add('d-none');

  let items = [];
  let errorMessage = null;

  try {
    const remote = await listPendingDeliveries(120);
    const dedup = new Map();
    (Array.isArray(remote) ? remote : []).forEach((entry) => {
      const normalized = normalizeNote(entry);
      if (!normalized) return;
      dedup.set(normalized.id, normalized);
    });
    items = Array.from(dedup.values());
  } catch (err) {
    errorMessage = err?.message || err?.code || String(err);
    logDebug('loadPendingList remote failed', { message: errorMessage });
  }

  if (items.length > 0) {
    items.sort(sortByNewest);
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
      const dateText = (item.date || item.createdAt || '').toString().split('T')[0];
      const amountText = item.amount ? `NT$ ${item.amount}` : '-';
      const hoursText = (item.totalHours ?? '-') + 'h';
      li.innerHTML = `<div>
          <div class="fw-semibold">${item.customer || '-'} / ${item.location || '-'} </div>
          <div class="text-muted small">日期: ${dateText || '-'} · 金額: ${amountText} · 工時: ${hoursText}</div>
        </div>
        <button class="btn btn-sm btn-outline-primary" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>`;
      li.addEventListener('click', (event) => {
        const targetId = event.target.closest('button')?.getAttribute('data-id') || item.id;
        selectPending(targetId);
      });
      pendingListEl.appendChild(li);
    });
  }

  if (errorMessage) {
    const li = document.createElement('li');
    li.className = 'list-group-item text-danger';
    li.textContent = `遠端載入失敗：${errorMessage}`;
    pendingListEl.appendChild(li);
  }

  if (pendingListEl.children.length === 0) {
    noPendingEl?.classList.remove('d-none');
  }

  if (pendingLoadingEl) {
    pendingLoadingEl.style.display = 'none';
    pendingLoadingEl.classList.add('d-none');
  }
  pendingListEl.style.display = 'block';

  try {
    injectLatestOffline();
  } catch (err) {
    logDebug('injectLatestOffline failed', { message: err?.message || err });
  }

  logDebug('loadPendingList done', { remoteCount: items.length, hasError: Boolean(errorMessage) });
}

async function loadNote(id) {
  if (!id) return;
  logDebug('loadNote start', { id });
  currentLocalId = null;
  currentDocId = null;
  noteSection?.classList.add('d-none');
  if (loadError) loadError.classList.add('d-none');

  try {
    const ref = doc(db, 'deliveryNotes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      logDebug('loadNote missing', { id });
      if (loadError) {
        loadError.textContent = '找不到這筆簽單，請重新整理列表。';
        loadError.classList.remove('d-none');
      }
      return;
    }
    const note = normalizeNote({ id, ...snap.data() });
    currentDocId = id;
    renderNote(note);
    logDebug('loadNote success', { id });
  } catch (err) {
    logDebug('loadNote failed', { message: err?.message || err, code: err?.code });
    if (loadError) {
      loadError.textContent = `載入簽單失敗：${err?.message || err}`;
      loadError.classList.remove('d-none');
    }
  }
}

function selectPending(id) {
  selectHintEl?.classList.add('d-none');
  loadNote(id);
}

function renderNote(d) {
  noteSection.classList.remove('d-none');
  const formatNames = (arr, fallback) => {
    try {
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map(x => x?.name || x?.displayName || x?.id || '').filter(Boolean).join('、');
      }
    } catch {}
    return fallback || '-';
  };
  const machinesText = formatNames(d.machines, d.machine || '-');
  const driversText = formatNames(d.drivers, d.driverName || '-');
  const date = (d.date || d.createdAt || '').toString().split('T')[0];
  noteBody.innerHTML = `
    <div class="row g-2 small">
      <div class="col-md-4"><strong>日期:</strong> ${date || '-'}</div>
      <div class="col-md-4"><strong>客戶:</strong> ${d.customer || '-'}</div>
      <div class="col-md-4"><strong>地點:</strong> ${d.location || '-'}</div>
      <div class="col-md-12"><strong>作業狀況:</strong><br>${(d.work || '').replace(/\n/g,'<br>') || '-'}</div>
      <div class="col-md-4"><strong>時間:</strong> ${(d.startTime||'') + (d.endTime?(' ~ '+d.endTime):'')}</div>
      <div class="col-md-4"><strong>金額:</strong> ${d.amount? 'NT$ '+d.amount : '-'}</div>
      <div class="col-md-4"><strong>機具:</strong> ${machinesText}</div>
      <div class="col-md-4"><strong>車號:</strong> ${d.vehicleNumber||'-'}</div>
      <div class="col-md-4"><strong>司機:</strong> ${driversText}</div>
      <div class="col-md-12"><strong>備註:</strong> ${(d.remark||'').replace(/\n/g,'<br>')||'-'}</div>
    </div>`;
  setStatusBadge(d.signatureStatus || 'pending');

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
        signatureStatus: 'completed'
      });
      setStatusBadge('completed');
      showSignedPreview(url, new Date().toISOString());
      if (prev?.signatureStoragePath && prev.signatureStoragePath !== filePath) {
        deleteOldSignature(currentDocId, prev.signatureStoragePath);
      }
    } else {
      // 離線：將 DataURL 暫存至離線簽單並加入簽章佇列
      const dataUrl = signaturePadCanvas.toDataURL('image/png');
      updateOfflineNoteSignature(currentLocalId, dataUrl);
      enqueueOfflineSignature({
        id: (crypto?.randomUUID?.() || (Date.now()+"_"+Math.random().toString(36).slice(2))),
        docId: null,
        localId: currentLocalId,
        localOnly: true,
        dataUrl,
        createdAt: new Date().toISOString(),
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

document.addEventListener('DOMContentLoaded', () => {
  loadPendingList();
  // URL 若帶 id 仍可直接載入（例如分享連結）
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

function updateOfflineNoteSignature(localId, dataUrl) {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_NOTES_KEY) || '[]');
    const idx = list.findIndex(x => x.localId === localId);
    if (idx >= 0) {
      list[idx].signatureStatus = 'completed';
      list[idx].signatureDataUrl = dataUrl;
      list[idx].signedAt = new Date().toISOString();
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

  // 建立現有清單鍵集合，避免重覆插入
  const existingKeys = new Set();
  if (!pendingListEl) return;

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

    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center list-group-item-warning';
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
    if (pendingLoadingEl) pendingLoadingEl.style.display = 'none';
    noPendingEl?.classList.add('d-none');
    pendingListEl.style.display = 'block';
    logDebug('injectLatestOffline injected', { injected });
  }
}

// 事件驅動：離線筆數變更或 storage 變更時即時插入
window.addEventListener('offline-count-changed', () => {
  logDebug('offline-count-changed event received, inject latest offline');
  try { injectLatestOffline(); } catch { loadPendingList(); }
});
window.addEventListener('storage', (e) => {
  if (e.key === OFFLINE_NOTES_KEY) {
    logDebug('storage event: offline notes changed, inject latest offline');
    try { injectLatestOffline(); } catch { loadPendingList(); }
  }
});
