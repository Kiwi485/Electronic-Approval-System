// offline.js - 離線資料管理與自動同步
// 提供 window.offlineManager 供其他模組使用
import { db, storage } from '../firebase-init.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-storage.js';
import { ensureUsageAppliedForDelivery } from './machine-usage.js';

class OfflineManager {
  constructor() {
    this.storageKey = 'offline_delivery_notes';
    this.uploadedKey = 'uploaded_local_ids';
    this.sigQueueKey = 'offline_signatures_queue';
    this.syncInProgress = false;
  }

  _readArray(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return fallback; }
  }
  _writeArray(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

  getOfflineData() { return this._readArray(this.storageKey); }
  getUploadedLocalIds() { return this._readArray(this.uploadedKey); }
  _readSigQueue() { return this._readArray(this.sigQueueKey); }
  _writeSigQueue(arr) { this._writeArray(this.sigQueueKey, arr); }

  hasUploaded(localId) { return this.getUploadedLocalIds().includes(localId); }

  markUploaded(localId) {
    const list = this.getUploadedLocalIds();
    if (!list.includes(localId)) { list.push(localId); this._writeArray(this.uploadedKey, list); }
  }

  async _ensureMachineUsageApplied(docId, noteData, reason) {
    if (!docId) return;
    if (noteData && (noteData.signatureStatus || 'pending') !== 'completed' && reason === 'offline-sync-add') {
      return;
    }
    try {
      const result = await ensureUsageAppliedForDelivery({ docId, noteData, reason });
      if (result && (result.applied || result.alreadyApplied) && noteData) {
        noteData.machineUsageApplied = true;
        if (result.machineId && !noteData.machineId) {
          noteData.machineId = result.machineId;
        }
      }
    } catch (err) {
      console.warn('[Offline] ensure machine usage failed', { docId, reason, message: err?.message });
    }
  }

  // 儲存離線資料
  saveOfflineData(deliveryNote) {
    const offlineData = this.getOfflineData();
    if (!deliveryNote.localId) deliveryNote.localId = (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`);
    deliveryNote.offline = true;
    if (!deliveryNote.signatureStatus) deliveryNote.signatureStatus = 'pending';
    if (!deliveryNote.createdAt) deliveryNote.createdAt = new Date().toISOString();
    offlineData.push(deliveryNote);
    this._writeArray(this.storageKey, offlineData);
    console.log('[Offline] 已離線儲存  localId=', deliveryNote.localId);
    window.dispatchEvent(new CustomEvent('offline-count-changed', { detail: { count: offlineData.length } }));
  }

  // 移除已同步資料 (以 localId)
  _removeByLocalId(localId) {
    const offlineData = this.getOfflineData().filter(n => n.localId !== localId);
    this._writeArray(this.storageKey, offlineData);
    window.dispatchEvent(new CustomEvent('offline-count-changed', { detail: { count: offlineData.length } }));
  }

  // Firestore 是否已存在此 localId (避免重複上傳)
  async remoteExists(localId) {
    try {
      const q = query(collection(db, 'deliveryNotes'), where('localId', '==', localId), limit(1));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (e) {
      console.warn('[Offline] remoteExists 查詢失敗:', e);
      return false;
    }
  }

  // 同步離線資料
  async syncOfflineData() {
    if (this.syncInProgress) return;
    const offlineData = this.getOfflineData();
    if (offlineData.length === 0) {
      console.log('[Offline] 無離線資料可同步');
      window.dispatchEvent(new CustomEvent('offline-sync-done', { detail: { count: 0 } }));
      if (navigator.onLine) {
        try { await this.applyQueuedDocIdSignatures(); } catch {}
        try { await this.applyQueuedLocalSignatures(); } catch {}
      }
      return;
    }
    if (!navigator.onLine) return;
    this.syncInProgress = true;
    console.log(`[Offline] 開始同步 ${offlineData.length} 筆`);
    window.dispatchEvent(new CustomEvent('offline-sync-start', { detail: { count: offlineData.length } }));

    for (const note of [...offlineData]) {
      try {
        if (this.hasUploaded(note.localId) || await this.remoteExists(note.localId)) {
          console.log('[Offline] 已存在(跳過) localId=', note.localId);
          this._removeByLocalId(note.localId);
          this.markUploaded(note.localId);
          continue;
        }
        const payload = { ...note, offline: false, serverCreatedAt: serverTimestamp() };
        const addedRef = await addDoc(collection(db, 'deliveryNotes'), payload);
        console.log('[Offline] 同步成功 localId=', note.localId, ' => docId=', addedRef.id);
        this._removeByLocalId(note.localId);
        this.markUploaded(note.localId);
        const noteStatus = (note.signatureStatus || ((note.signatureUrl || note.signatureDataUrl) ? 'completed' : 'pending'));
        if (noteStatus === 'completed') {
          await this._ensureMachineUsageApplied(addedRef.id, note, 'offline-sync-add');
        }

        // 套用對應 localId 的離線簽章（會上傳 PNG 至 Storage 並更新 Firestore）
        try {
          const related = this._readSigQueue().filter(s => s.localId === note.localId && !s.docId);
          if (related.length) {
            console.log('[Offline] 發現離線簽章待上傳 localId=', note.localId, ' count=', related.length);
            for (const sigItem of related) {
              await this._applySignatureToDoc(addedRef.id, sigItem);
            }
          }
        } catch (sigQueueErr) {
          console.warn('[Offline] 檢查離線簽章佇列錯誤 localId=', note.localId, sigQueueErr);
        }
      } catch (error) {
        console.error('[Offline] 同步失敗 localId=', note.localId, error);
        this.syncInProgress = false;
        window.dispatchEvent(new CustomEvent('offline-sync-error', { detail: { error, localId: note.localId } }));
        return;
      }
    }

    this.syncInProgress = false;
    console.log('[Offline] 所有離線資料同步完成');
    window.dispatchEvent(new CustomEvent('offline-sync-done', { detail: { count: offlineData.length } }));

    // 單據同步完成後，再嘗試處理任何殘留的簽章佇列
    try { await this.applyQueuedDocIdSignatures(); } catch {}
    try { await this.applyQueuedLocalSignatures(); } catch {}
  }

  // 將 dataURL 轉為 Blob
  async _dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return blob;
  }

  // 上傳簽章圖至 Storage 並回傳 { url, path }
  async _uploadSignatureToStorage(docId, dataUrl) {
    const blob = await this._dataUrlToBlob(dataUrl);
    const filePath = `signatures/${docId}_${Date.now()}.png`;
    const fileRef = storageRef(storage, filePath);
    await uploadBytes(fileRef, blob, { contentType: 'image/png' });
    const url = await getDownloadURL(fileRef);
    return { url, path: filePath };
  }

  // 共用：將簽章套用至指定 docId，成功後自動移除佇列中的該項目
  async _applySignatureToDoc(docId, sigItem) {
    try {
      let url = null, path = null;
      try {
        const uploaded = await this._uploadSignatureToStorage(docId, sigItem.dataUrl);
        url = uploaded.url; path = uploaded.path;
      } catch (e) {
        console.warn('[Offline] 簽章上傳 Storage 失敗，改寫入 DataURL', e);
      }

      const updatePayload = {
        signedAt: serverTimestamp(),
        signatureStatus: 'completed'
      };
      if (url && path) {
        updatePayload.signatureUrl = url;
        updatePayload.signatureStoragePath = path;
        updatePayload.signatureDataUrl = null;
      } else {
        // Storage 上傳失敗時，退而求其次保留 DataURL（避免資料遺失）
        updatePayload.signatureDataUrl = sigItem.dataUrl;
      }
      await updateDoc(doc(db, 'deliveryNotes', docId), updatePayload);

      // 從簽章佇列移除此項
      const remain = this._readSigQueue().filter(x => x.id !== sigItem.id);
      this._writeSigQueue(remain);
      console.log('[Offline] 已套用離線簽章到 docId=', docId);
      await this._ensureMachineUsageApplied(docId, null, 'offline-queue-signature');
    } catch (err) {
      console.warn('[Offline] 套用簽章至 doc 失敗', docId, err);
    }
  }

  // 情境一：簽章佇列中已有 docId（例如其他流程加入的項目）
  async applyQueuedDocIdSignatures() {
    if (!navigator.onLine) return;
    const queue = this._readSigQueue();
    const targets = queue.filter(x => x.docId);
    if (!targets.length) return;
    console.log('[Offline] 套用佇列簽章（已含 docId）筆數=', targets.length);
    for (const item of targets) {
      await this._applySignatureToDoc(item.docId, item);
    }
  }

  // 情境二：簽章佇列只有 localId（離線建立的單據），需先找出對應 docId 再上傳
  async applyQueuedLocalSignatures() {
    if (!navigator.onLine) return;
    const queue = this._readSigQueue();
    const targets = queue.filter(x => !x.docId && x.localId);
    if (!targets.length) return;
    console.log('[Offline] 套用佇列簽章（僅 localId）筆數=', targets.length);
    for (const item of targets) {
      try {
        const q = query(collection(db, 'deliveryNotes'), where('localId', '==', item.localId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          await this._applySignatureToDoc(docId, item);
        } else {
          console.warn('[Offline] 仍找不到對應 docId，稍後再試 localId=', item.localId);
        }
      } catch (e) {
        console.warn('[Offline] 尋找對應 docId 失敗 localId=', item.localId, e);
      }
    }
  }
}

export const offlineManager = new OfflineManager();
window.offlineManager = offlineManager; // 方便在 console 測試

// 網路狀態監聽
window.addEventListener('online', () => {
  console.log('[Offline] 網路已連線，嘗試同步');
  offlineManager.syncOfflineData();
  // 單據同步觸發外，也嘗試直接處理任何簽章佇列（避免必須先有離線單據才處理）
  setTimeout(() => offlineManager.applyQueuedDocIdSignatures().catch(()=>{}), 500);
  setTimeout(() => offlineManager.applyQueuedLocalSignatures().catch(()=>{}), 1200);
});
window.addEventListener('offline', () => {
  console.log('[Offline] 網路已中斷，進入離線模式');
});

// 初始化時若網路已連線就試著同步
if (navigator.onLine) {
  setTimeout(() => offlineManager.syncOfflineData(), 800);
  setTimeout(() => offlineManager.applyQueuedDocIdSignatures().catch(()=>{}), 1500);
  setTimeout(() => offlineManager.applyQueuedLocalSignatures().catch(()=>{}), 2200);
}

// 初始化時告知目前離線筆數
window.dispatchEvent(new CustomEvent('offline-count-changed', { detail: { count: offlineManager.getOfflineData().length } }));
