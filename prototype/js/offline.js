// offline.js - 離線資料管理與自動同步
// 提供 window.offlineManager 供其他模組使用
import { db } from '../firebase-init.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

class OfflineManager {
  constructor() {
    this.storageKey = 'offline_delivery_notes';
    this.uploadedKey = 'uploaded_local_ids';
    this.syncInProgress = false;
  }

  _readArray(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return fallback; }
  }
  _writeArray(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

  getOfflineData() { return this._readArray(this.storageKey); }
  getUploadedLocalIds() { return this._readArray(this.uploadedKey); }

  hasUploaded(localId) { return this.getUploadedLocalIds().includes(localId); }

  markUploaded(localId) {
    const list = this.getUploadedLocalIds();
    if (!list.includes(localId)) { list.push(localId); this._writeArray(this.uploadedKey, list); }
  }

  // 儲存離線資料
  saveOfflineData(deliveryNote) {
    const offlineData = this.getOfflineData();
    if (!deliveryNote.localId) deliveryNote.localId = crypto.randomUUID();
    deliveryNote.offline = true;
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
      return false; // 查不到時稍後再試
    }
  }

  // 同步離線資料
  async syncOfflineData() {
    if (this.syncInProgress) return;
    const offlineData = this.getOfflineData();
    if (offlineData.length === 0) {
      console.log('[Offline] 無離線資料可同步');
      // 沒有資料也通知前端 (方便 UI 立即更新狀態列)
      window.dispatchEvent(new CustomEvent('offline-sync-done', { detail: { count: 0 } }));
      return;
    }
    if (!navigator.onLine) return;
    this.syncInProgress = true;
    console.log(`[Offline] 開始同步 ${offlineData.length} 筆`);
    window.dispatchEvent(new CustomEvent('offline-sync-start', { detail: { count: offlineData.length } }));
    for (const note of offlineData) {
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

        // 嘗試套用對應 localId 的離線簽章 (localOnly entries)
        try {
          const SIG_KEY = 'offline_signatures_queue';
          const list = JSON.parse(localStorage.getItem(SIG_KEY) || '[]');
          const related = list.filter(s => (s.localOnly && s.localId === note.localId) || (!s.docId && s.localId === note.localId));
          if (related.length) {
            console.log('[Offline] 發現離線簽章待套用 localId=', note.localId, ' count=', related.length);
            for (const sigItem of related) {
              try {
                await updateDoc(doc(db, 'deliveryNotes', addedRef.id), {
                  signatureDataUrl: sigItem.dataUrl,
                  signedAt: serverTimestamp(),
                  signatureStatus: 'completed'
                });
                // 移除該簽章項目
                const remain = list.filter(x => x.id !== sigItem.id);
                localStorage.setItem(SIG_KEY, JSON.stringify(remain));
                console.log('[Offline] 已套用離線簽章到 docId=', addedRef.id);
              } catch (sigErr) {
                console.warn('[Offline] 套用離線簽章失敗 docId=', addedRef.id, sigErr);
              }
            }
          }
        } catch (sigQueueErr) {
          console.warn('[Offline] 檢查離線簽章佇列錯誤 localId=', note.localId, sigQueueErr);
        }
      } catch (error) {
        console.error('[Offline] 同步失敗 localId=', note.localId, error);
        // 中斷，稍後重新再試，以避免快速重試
        this.syncInProgress = false;
        window.dispatchEvent(new CustomEvent('offline-sync-error', { detail: { error, localId: note.localId } }));
        return;
      }
    }
    this.syncInProgress = false;
    console.log('[Offline] 所有離線資料同步完成');
    window.dispatchEvent(new CustomEvent('offline-sync-done', { detail: { count: offlineData.length } }));
  }
}

export const offlineManager = new OfflineManager();
window.offlineManager = offlineManager; // 方便在 console 測試

// 網路狀態監聽
window.addEventListener('online', () => {
  console.log('[Offline] 網路已連線，嘗試同步');
  offlineManager.syncOfflineData();
});
window.addEventListener('offline', () => {
  console.log('[Offline] 網路已中斷，進入離線模式');
});

// 初始化時若網路已連線就試著同步
if (navigator.onLine) {
  setTimeout(() => offlineManager.syncOfflineData(), 1000);
}

// 初始化時告知目前離線筆數
window.dispatchEvent(new CustomEvent('offline-count-changed', { detail: { count: offlineManager.getOfflineData().length } }));
