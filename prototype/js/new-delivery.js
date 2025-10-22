// new-delivery.js - 處理新增簽單 (含離線提交)
import { db } from '../firebase-init.js';
import { buildValidatedPayload } from './form-validation.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");

// 依旗標決定是否走 Mock 寫入（不修改 config-flags.js 結構）
const SHOULD_USE_MOCK = (window.APP_FLAGS?.USE_MOCK_DATA ?? true) === true;

async function submitOnline(data) {
  const payload = { ...data, offline: false, serverCreatedAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'deliveryNotes'), payload);
  console.log('✅ 上線新增成功 ID:', docRef.id);
  return docRef.id;
}

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

  // Mock 模式：直接寫入 mock 報表資料（不呼叫 Firestore）
  if (SHOULD_USE_MOCK) {
    try {
      const reportRow = {
        id: data.localId,
        localId: data.localId,
        date: (new Date()).toISOString().slice(0,10),
        customer: data.customer || data.customerName || '',
        item: data.item || '',
        origin: data.origin || '',
        destination: data.destination || '',
        quantity: Number(data.quantity) || 0,
        unit: data.unit || '',
        amount: Number(data.amount) || 0,
        receivedCash: !!data.paidAt,
        paidAt: data.paidAt || null,
        modelName: data.modelName || data.machineName || '',
        driverName: data.driverName || data.driver || '',
        vehicleNumber: data.vehicleNumber || data.vehicle || ''
      };
      const mod = await import('./reports-mock-data.js');
      const ok = mod.saveMockReportRow(reportRow);
      finish(ok, ok ? '已以 Mock 模式建立並儲存單據（可在報表看到）' : 'Mock 儲存發生問題，但表單仍已處理');
    } catch (err) {
      console.warn('[Mock] 無法儲存 mock 單據', err);
      finish(false, 'Mock 儲存失敗');
    }
    return;
  }

  if (!navigator.onLine) {
    offlineManager.saveOfflineData(data);
    finish(true, '目前離線，已暫存並將於連線後自動上傳。');
    return;
  }

  try {
    await submitOnline(data);
    finish(true, '完成簽單成功！');
  } catch (error) {
    console.warn('線上提交失敗，改為離線暫存', error);
    offlineManager.saveOfflineData(data);
    finish(false, '網路/伺服器問題，資料已暫存離線稍後同步。');
  }
});
