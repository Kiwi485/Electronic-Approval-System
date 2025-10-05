// new-delivery.js - 處理新增簽單 (含離線提交)
import { db } from './firebase-init.js';
import { ensureAuth, signOutUser, subscribeAuth } from './auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");
const welcomeBanner = document.getElementById('welcomeBanner');
const driverNameField = document.getElementById('driverName');
const vehicleNumberField = document.getElementById('vehicleNumber');
const logoutBtn = document.getElementById('logoutButton');
const customerField = form?.querySelector("input[list='customerList']");
const dateField = form?.querySelector("input[type='date']");
const locationField = form?.querySelector("input[name='location']");
const workField = form?.querySelector('textarea[name="work"]');
const startTimeField = form?.querySelector("input[name='startTime']");
const endTimeField = form?.querySelector("input[name='endTime']");
const amountField = document.getElementById('amount');
const totalHoursField = document.getElementById('totalHours');
const timeFillButtons = document.querySelectorAll('[data-time-fill]');
const timeAdjustButtons = document.querySelectorAll('[data-time-adjust]');

let currentProfile = null;
let manualTotalHoursOverride = false;

const padTime = (value) => value.toString().padStart(2, '0');

function applyDriverProfile(profile) {
  if (profile !== undefined) currentProfile = profile;
  if (!driverNameField || !vehicleNumberField) return;
  const activeProfile = currentProfile;
  driverNameField.value = activeProfile?.name || '';
  driverNameField.placeholder = activeProfile ? '' : '請先登入';
  driverNameField.readOnly = !!activeProfile;
  vehicleNumberField.value = activeProfile?.vehicleNumber || '';
  vehicleNumberField.placeholder = activeProfile ? '' : '請先登入';
  vehicleNumberField.readOnly = !!activeProfile;
}

function renderWelcome(profile) {
  const activeProfile = profile !== undefined ? profile : currentProfile;
  if (!welcomeBanner) return;
  if (activeProfile) {
    welcomeBanner.classList.remove('d-none');
    welcomeBanner.querySelector('[data-user-name]').textContent = activeProfile.name || activeProfile.email;
    welcomeBanner.querySelector('[data-user-email]').textContent = activeProfile.email;
  } else {
    welcomeBanner.classList.add('d-none');
  }
}

logoutBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  await signOutUser({ redirectToLogin: true });
});

ensureAuth();

subscribeAuth((user, profile) => {
  if (user) {
    applyDriverProfile(profile);
    renderWelcome(profile);
  } else {
    applyDriverProfile(null);
    renderWelcome(null);
  }
});

function toMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return '';
  const minutesInDay = 24 * 60;
  let normalized = totalMinutes % minutesInDay;
  if (normalized < 0) normalized += minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
}

function parseManualTotalHours() {
  if (!totalHoursField) return null;
  const raw = totalHoursField.value.trim();
  if (raw === '') return null;
  const numeric = Number.parseFloat(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 10) / 10;
}

function updateWorkDuration({ force = false } = {}) {
  if (!totalHoursField) return null;
  if (!force && manualTotalHoursOverride) {
    return parseManualTotalHours();
  }

  const startMinutes = toMinutes(startTimeField?.value || '');
  const endMinutes = toMinutes(endTimeField?.value || '');
  if (startMinutes === null || endMinutes === null) {
    if (!manualTotalHoursOverride || force) totalHoursField.value = '';
    return null;
  }

  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60; // 支援跨日
  const hours = Math.round((diff / 60) * 10) / 10;
  if (Number.isNaN(hours) || !Number.isFinite(hours) || hours <= 0) {
    if (!manualTotalHoursOverride || force) totalHoursField.value = '';
    return null;
  }

  manualTotalHoursOverride = false;
  totalHoursField.value = hours.toFixed(1);
  return hours;
}

startTimeField?.addEventListener('change', updateWorkDuration);
endTimeField?.addEventListener('change', updateWorkDuration);

timeFillButtons.forEach((btn) => {
  const target = btn.getAttribute('data-time-fill');
  btn.addEventListener('click', () => {
    const now = new Date();
    const timeValue = `${padTime(now.getHours())}:${padTime(now.getMinutes())}`;
    if (target === 'start' && startTimeField) {
      startTimeField.value = timeValue;
    } else if (target === 'end' && endTimeField) {
      endTimeField.value = timeValue;
    }
    updateWorkDuration();
  });
});

timeAdjustButtons.forEach((btn) => {
  const descriptor = btn.getAttribute('data-time-adjust');
  if (!descriptor) return;
  const [target, deltaStr] = descriptor.split(':');
  const delta = Number.parseInt(deltaStr, 10);
  if (!Number.isFinite(delta)) return;

  btn.addEventListener('click', () => {
    const field = target === 'start' ? startTimeField : endTimeField;
    if (!field) return;

    const baseMinutes = toMinutes(field.value);
    if (baseMinutes === null) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      field.value = minutesToTimeString(currentMinutes + delta);
    } else {
      field.value = minutesToTimeString(baseMinutes + delta);
    }

    manualTotalHoursOverride = false;
    updateWorkDuration();
  });
});

totalHoursField?.addEventListener('input', () => {
  if (!totalHoursField) return;
  const raw = totalHoursField.value.trim();
  manualTotalHoursOverride = raw !== '';
});

totalHoursField?.addEventListener('blur', () => {
  if (!totalHoursField) return;
  if (!manualTotalHoursOverride) {
    updateWorkDuration();
    return;
  }

  const manualValue = parseManualTotalHours();
  if (manualValue === null) {
    totalHoursField.value = '';
    manualTotalHoursOverride = false;
    return;
  }
  totalHoursField.value = manualValue.toFixed(1);
});

function getAmountValue() {
  if (!amountField) return 0;
  const amount = Number.parseFloat(amountField.value);
  if (!Number.isFinite(amount) || amount < 0) return NaN;
  return Math.round(amount * 10) / 10; // 與 UI step 對齊
}

function gatherFormData(totalHours, amount) {
  return {
    localId: crypto.randomUUID(),
    userEmail: currentProfile?.email || '',
    driverName: driverNameField?.value.trim() || '',
    vehicleNumber: vehicleNumberField?.value.trim() || '',
    customer: customerField?.value.trim() || '',
    date: dateField?.value || '',
    location: locationField?.value.trim() || '',
    work: workField?.value.trim() || '',
    startTime: startTimeField?.value || '',
    endTime: endTimeField?.value || '',
    totalHours: Number.isFinite(totalHours) ? totalHours : 0,
    amount: Number.isFinite(amount) ? amount : 0,
    status: 'completed',
    completedAt: new Date().toISOString(),
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
  if (!form || !submitBtn) return;

  const totalHours = manualTotalHoursOverride
    ? parseManualTotalHours()
    : updateWorkDuration({ force: true });
  form.classList.add('was-validated');

  if (!form.checkValidity()) {
    alert('請確認必填欄位均已填寫。');
    return;
  }

  if (totalHours === null) {
    alert('請確認開始與結束時間或手動輸入的總工時需大於 0。');
    return;
  }

  if (manualTotalHoursOverride && totalHours !== null && totalHoursField) {
    totalHoursField.value = totalHours.toFixed(1);
  }

  const amountValue = getAmountValue();
  if (!Number.isFinite(amountValue)) {
    alert('請輸入有效的金額，可為整數或 0.5 倍數。');
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>處理中...';

  const data = gatherFormData(totalHours, amountValue);
  console.log('📌 表單資料:', data);

  const finish = (ok, msg) => {
    alert(msg);
    if (ok) {
      form.reset();
      form.classList.remove('was-validated');
      manualTotalHoursOverride = false;
      updateWorkDuration();
    }
    applyDriverProfile();
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

form?.addEventListener('reset', () => {
  form.classList.remove('was-validated');
  manualTotalHoursOverride = false;
  if (totalHoursField) totalHoursField.value = '';
  if (amountField) amountField.value = '';
});
