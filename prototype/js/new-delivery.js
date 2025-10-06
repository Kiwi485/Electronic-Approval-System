// new-delivery.js - 處理新增簽單：離線優先提交，線上再背景同步
import { buildValidatedPayload } from './form-validation.js';
import { offlineManager } from './offline.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");

// 不再直接呼叫 Firestore；統一交由 offlineManager 在連線時自動同步

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!submitBtn) return;
  // 向驗證模組取得驗證後 payload
  const v = buildValidatedPayload();
  if (!v.ok) {
    alert('請先修正表單錯誤');
    return;
  }
  const baseData = v.data;
  const data = {
    localId: crypto.randomUUID(),
    ...baseData,
    signatureStatus: baseData.signatureStatus || 'pending',
    createdAt: new Date().toISOString()
  };
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>處理中...';
  console.log('📌 表單資料(驗證後):', data);

  const finish = (ok, msg) => {
    alert(msg);
    if (ok) form.reset();
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  };

  // 離線優先：一律先暫存到本機，確保不丟單
  offlineManager.saveOfflineData(data);
  // 若目前在線，背景觸發同步（失敗也不影響 UI）
  if (navigator.onLine) {
    setTimeout(() => offlineManager.syncOfflineData(), 0);
  }
  finish(true, navigator.onLine
    ? '已儲存並背景同步中（若失敗將稍後自動重試）。'
    : '目前離線，已暫存並將於連線後自動上傳。'
  );
});
