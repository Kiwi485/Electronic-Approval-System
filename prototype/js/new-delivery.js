// new-delivery.js - 處理新增簽單 (含離線提交)
import { db } from '../firebase-init.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");

function gatherFormData() {
  return {
    localId: crypto.randomUUID(),
    customer: form.querySelector("input[list='customerList']").value.trim(),
    date: form.querySelector("input[type='date']").value,
    location: form.querySelector("input[name='location']").value.trim(),
    work: form.querySelector('textarea[name="work"]').value.trim(),
    startTime: form.querySelectorAll("input[type='time']")[0].value,
    endTime: form.querySelectorAll("input[type='time']")[1].value,
    createdAt: new Date().toISOString(),
  };
}

async function submitOnline(data) {
  const payload = { ...data, offline: false, serverCreatedAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'deliveryNotes'), payload);
  console.log('✅ 上線新增成功 ID:', docRef.id);
  return docRef.id;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!submitBtn) return;
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>處理中...';

  const data = gatherFormData();
  console.log('📌 表單資料:', data);

  const finish = (ok, msg) => {
    alert(msg);
    if (ok) form.reset();
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  };

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
