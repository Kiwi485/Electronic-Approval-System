// sign-delivery.js - 單獨簽章頁面
import { db } from '../firebase-init.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js';
import { storage } from '../firebase-init.js';

// 供離線使用的 key（最小變更：不依賴 offline.js API，直接讀 localStorage）
const OFFLINE_NOTES_KEY = 'offline_delivery_notes';
const SIG_QUEUE_KEY = 'offline_signatures_queue';
const PENDING_CACHE_KEY = 'cached_pending_sign_docs';

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

let currentDocId = null;
let currentLocalId = null; // 若為離線暫存單據
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
  try {
    // 離線時直接用快取
    if (!navigator.onLine) {
      const cached = loadPendingCache();
      const data = cached.find(x => x.id === id);
      if (data) {
        currentDocId = id; // 保留 id 以利回線後處理
        renderNote(data);
        return;
      }
      throw new Error('離線狀態且找不到快取資料');
    }
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
    // 嘗試使用快取
    const cached = loadPendingCache();
    const data = cached.find(x => x.id === id);
    if (data) {
      currentDocId = id;
      renderNote(data);
    } else {
      if (loadError) {
        loadError.textContent = '載入失敗：' + e.message;
        loadError.classList.remove('d-none');
      }
    }
  }
}

async function loadPendingList() {
  logDebug('loadPendingList start');
  pendingListEl.style.display = 'none';
  pendingLoadingEl.style.display = 'block';
  noPendingEl.classList.add('d-none');
  pendingListEl.innerHTML = '';
  // 先注入離線待簽項目（黃色）
  const offlineList = getOfflinePendingNotes();
  let offlineCount = 0;
  try {
    offlineList.forEach(item => {
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
      pendingListEl.appendChild(li);
      offlineCount++;
    });
  } catch {}
  let timeoutHit = false;
  const to = setTimeout(() => {
    timeoutHit = true;
    logDebug('pendingList timeout fallback triggered (5s)');
    pendingLoadingEl.innerHTML = '<span class="text-warning small">載入逾時，嘗試較簡單查詢...</span>';
  }, 5000);
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
    logDebug('pending count', { count: items.length });
    // 線上成功後快取最小必要欄位（其實包含細節以便離線顯示）
    try {
      const min = items.map(x => ({
        id: x.id,
        customer: x.customer || null,
        location: x.location || null,
        date: x.date || null,
        createdAt: x.createdAt || null,
        work: x.work || null,
        startTime: x.startTime || null,
        endTime: x.endTime || null,
        amount: x.amount || null,
        machine: x.machine || null,
        vehicleNumber: x.vehicleNumber || null,
        driverName: x.driverName || null,
        remark: x.remark || null,
        signatureStatus: x.signatureStatus || 'pending'
      }));
      localStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(min));
    } catch {}
    if (items.length === 0 && offlineCount === 0) {
      noPendingEl.classList.remove('d-none');
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
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
      pendingListEl.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    logDebug('loadPendingList error', { message: e.message, code: e.code });
    // 改為使用快取渲染
    const cached = loadPendingCache();
    if (cached.length) {
      cached.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        const date = (item.date || item.createdAt || '').toString().split('T')[0];
        li.innerHTML = `<div>
            <div class="fw-semibold">${item.customer || '-'} / ${item.location || '-'} <span class="badge bg-secondary ms-1">快取</span></div>
            <div class="text-muted small">日期: ${date || '-'} · 金額: ${item.amount ? 'NT$ ' + item.amount : '-'} · 工時: ${item.totalHours ?? '-'}h</div>
          </div>
          <button class="btn btn-sm btn-outline-primary" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>`;
        li.addEventListener('click', (e) => {
          const targetId = e.target.closest('button')?.getAttribute('data-id') || item.id;
          selectPending(targetId);
        });
        pendingListEl.appendChild(li);
      });
    } else {
      if (offlineCount === 0) {
        pendingListEl.innerHTML = `<li class="list-group-item text-danger">載入失敗：${e.message}</li>`;
      }
    }
  } finally {
    clearTimeout(to);
    pendingLoadingEl.style.display = 'none';
    pendingListEl.style.display = 'block';
    if (timeoutHit) logDebug('timeout ended after fallback');
  }
}

function selectPending(id) {
  selectHintEl?.classList.add('d-none');
  loadNote(id);
}

function selectPendingOffline(localId) {
  selectHintEl?.classList.add('d-none');
  loadOfflineNote(localId);
}

function renderNote(d) {
  noteSection.classList.remove('d-none');
  const date = (d.date || d.createdAt || '').toString().split('T')[0];
  noteBody.innerHTML = `
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

  if (d.signatureStatus === 'completed' && d.signatureDataUrl) {
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
      // 離線：將 DataURL 暫存至離線簽單與簽章佇列
      const dataUrl = signaturePadCanvas.toDataURL('image/png');
      if (currentLocalId) updateOfflineNoteSignature(currentLocalId, dataUrl);
      enqueueOfflineSignature({
        id: (crypto?.randomUUID?.() || (Date.now()+"_"+Math.random().toString(36).slice(2))),
        docId: currentDocId || null,
        localId: currentLocalId || null,
        localOnly: !!currentLocalId,
        dataUrl,
        createdAt: new Date().toISOString()
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

function getOfflinePendingNotes() {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_NOTES_KEY) || '[]');
    return list.filter(x => (x.signatureStatus || 'pending') === 'pending');
  } catch { return []; }
}

function loadPendingCache() {
  try { return JSON.parse(localStorage.getItem(PENDING_CACHE_KEY) || '[]'); } catch { return []; }
}

// 事件驅動：離線筆數有變動時，立即刷新清單（<= 1 秒）
function injectLatestOffline() {
  // 為保持邏輯一致與簡單，直接重用現有渲染流程
  loadPendingList();
}
window.addEventListener('offline-count-changed', injectLatestOffline);

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
