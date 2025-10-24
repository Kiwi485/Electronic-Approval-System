// new-delivery.js - 處理新增簽單 (含離線提交)
import { db } from '../firebase-init.js';
import { buildValidatedPayload } from './form-validation.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';
import { getApiSource } from './api/index.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");

// 預設表單日期為『今天』（本地時區），避免新增後『今日簽單』不計入
function pad(n){ return String(n).padStart(2,'0'); }
function localDateStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
document.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('date');
  if (dateEl && !dateEl.value) dateEl.value = localDateStr();
});

async function waitForFlags(timeout = 1000) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 50));
  }
  return window.APP_FLAGS;
}

// 不在模組載入時就決定 mock/firestore（避免 config 仍在載入時被鎖定）

async function submitOnline(data) {
  const payload = { ...data, offline: false, serverCreatedAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'deliveryNotes'), payload);
  console.log('✅ 上線新增成功 ID:', docRef.id);
  return docRef.id;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!submitBtn) return;
  // 確保 flags 已讀取，避免 race condition
  try { await waitForFlags(1200); } catch {}
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
    // 預設為未收款（供首頁「未收款」統計使用）
    paidAt: null,
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

  // 於送出時決定目前 API 來源（避免模組載入時 flag 尚未就緒造成誤判）
  const srcNow = (typeof getApiSource === 'function') ? getApiSource() : (window.APP_FLAGS?.USE_MOCK_DATA ? 'mock' : 'firestore');
  const shouldUseMock = srcNow === 'mock';
  console.info('[Delivery] submit-time flags snapshot:', { APP_FLAGS: window.APP_FLAGS, srcNow });

  // Mock 模式：直接寫入 mock 報表資料（不呼叫 Firestore）
  if (shouldUseMock) {
    // double-check runtime source; if flags/state disagree, avoid accidentally using mock
    if (srcNow !== 'mock') {
      console.warn('[Delivery] mock branch requested but runtime source is', srcNow, '— falling back to Firestore submit to avoid accidental mock write');
      try {
        const realId = await submitOnline(data);
        finish(true, '完成簽單成功！');
        return;
      } catch (err) {
        console.error('[Delivery] fallback Firestore submit failed after mock-branch guard', err);
        offlineManager.saveOfflineData(data);
        finish(false, '網路/伺服器問題，資料已暫存離線稍後同步。');
        return;
      }
    }
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
      finish(ok, ok ? '完成簽單成功！' : '儲存發生問題，但表單仍已處理');
    } catch (err) {
      console.warn('[Mock] 無法儲存 mock 單據', err);
        finish(false, '儲存失敗');
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
