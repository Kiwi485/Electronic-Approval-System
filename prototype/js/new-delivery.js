// new-delivery.js - 處理新增簽單 (含離線提交)
import { db } from '../firebase-init.js';
import { buildValidatedPayload } from './form-validation.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { offlineManager } from './offline.js';
import { getApiSource } from './api/index.js';
import { getUserContext } from './session-context.js';

console.log('🚀 new-delivery.js 已載入');

const form = document.getElementById('deliveryForm');
const submitBtn = form?.querySelector("button[type='submit']");
const dateInput = document.getElementById('date');
const driverField = document.getElementById('driverName');
const machineField = document.getElementById('machine');
const vehicleField = document.getElementById('vehicleNumber');

let cachedUserContextPromise = null;
let selfDriverEntryCache = null;

function fetchUserContext() {
  if (!cachedUserContextPromise) {
    cachedUserContextPromise = getUserContext().catch(err => {
      console.warn('[Delivery] getUserContext failed', err);
      return {};
    });
  }
  return cachedUserContextPromise;
}

function resolveSelfDriverEntry(context = {}) {
  if (selfDriverEntryCache) return selfDriverEntryCache;
  const uid = (context.uid || context.user?.uid || '').trim();
  const profile = context.profile || {};
  const user = context.user || {};
  const email = profile.email || user.email || null;
  const name = profile.displayName || user.displayName || (email ? email.split('@')[0] : '目前司機');
  const catalog = Array.isArray(window.__EAS_DRIVER_CATALOG) ? window.__EAS_DRIVER_CATALOG : [];
  const match = catalog.find(entry => {
    if (!entry) return false;
    const entryId = (entry.id || entry.uid || entry.docId || '').trim();
    if (uid && (entryId === uid || entry.uid === uid)) return true;
    if (email && entry.email && entry.email.toLowerCase() === email.toLowerCase()) return true;
    return false;
  }) || null;
  const displayName = match?.displayName || name || '目前司機';
  const driverId = uid || match?.uid || match?.id || '';
  const driverEmail = match?.email || email || null;
  const driverDocId = match?.docId || ((match?.id && match.id !== driverId) ? match.id : null);
  selfDriverEntryCache = {
    id: driverId || uid || '',
    name: displayName,
    displayName,
    docId: driverDocId || null,
    email: driverEmail
  };
  if (!selfDriverEntryCache.id && driverEmail) {
    selfDriverEntryCache.id = `email:${driverEmail}`;
  }
  return selfDriverEntryCache;
}

function enforceDriverUiLock(context = {}) {
  if (!driverField) return;
  const entry = resolveSelfDriverEntry(context);
  if (!entry) return;
  const displayName = entry.displayName || entry.name || '目前司機';
  const isSelect = driverField.tagName?.toLowerCase() === 'select';
  if (isSelect) {
    const options = Array.from(driverField.options || []);
    const isSelfOption = (opt) => {
      if (!opt) return false;
      if (entry.id && (opt.dataset.uid === entry.id || opt.dataset.id === entry.id)) return true;
      if (entry.email && opt.dataset.email && opt.dataset.email.toLowerCase() === entry.email.toLowerCase()) return true;
      if (!entry.id && opt.value === displayName) return true;
      return false;
    };
    let targetOption = options.find(isSelfOption);
    if (!targetOption) {
      targetOption = document.createElement('option');
      targetOption.value = displayName;
      targetOption.textContent = displayName;
      driverField.appendChild(targetOption);
    }
    targetOption.dataset.name = displayName;
    if (entry.id) {
      targetOption.dataset.id = entry.id;
      targetOption.dataset.uid = entry.id;
    }
    if (entry.docId) targetOption.dataset.docId = entry.docId;
    if (entry.email) targetOption.dataset.email = entry.email;
    targetOption.selected = true;
    driverField.value = targetOption.value;
    driverField.disabled = true;
    if (!driverField.__selfLockObserver) {
      const observer = new MutationObserver(() => {
        setTimeout(() => enforceDriverUiLock(context), 0);
      });
      observer.observe(driverField, { childList: true });
      driverField.__selfLockObserver = observer;
    }
  } else {
    driverField.value = displayName;
    driverField.readOnly = true;
    driverField.setAttribute('aria-readonly', 'true');
  }
  const multiSection = document.getElementById('multiDriverSection');
  if (multiSection) multiSection.classList.add('d-none');
  const multiChecks = document.querySelectorAll('#driversOptions input[type="checkbox"]');
  multiChecks.forEach(cb => {
    let isSelf = entry.id && (cb.dataset.uid === entry.id || cb.dataset.id === entry.id);
    if (!isSelf && entry.email) {
      const email = cb.dataset.email || '';
      if (email && email.toLowerCase() === entry.email.toLowerCase()) isSelf = true;
    }
    cb.checked = isSelf;
    cb.disabled = true;
  });
  const driversContainer = document.getElementById('driversOptions');
  if (driversContainer && !driversContainer.__selfLockObserver) {
    const observer = new MutationObserver(() => {
      setTimeout(() => enforceDriverUiLock(context), 0);
    });
    observer.observe(driversContainer, { childList: true });
    driversContainer.__selfLockObserver = observer;
  }
}

function getMachineCatalogSnapshot() {
  const list = Array.isArray(window.__EAS_MACHINE_CATALOG) ? window.__EAS_MACHINE_CATALOG : [];
  return list.map(item => ({
    id: item?.id || '',
    name: item?.name || '',
    vehicleNumber: item?.vehicleNumber || ''
  }));
}

function lookupMachineMetaById(id) {
  if (!id) return null;
  const catalog = getMachineCatalogSnapshot();
  return catalog.find(entry => entry.id === id) || null;
}

function getSelectedMachineMeta() {
  if (!machineField) return null;
  const tag = machineField.tagName?.toLowerCase();
  if (tag !== 'select') {
    const value = machineField.value ? machineField.value.trim() : '';
    if (!value) return null;
    const catalog = getMachineCatalogSnapshot();
    return catalog.find(entry => entry.name === value) || null;
  }
  const opt = machineField.options?.[machineField.selectedIndex];
  if (!opt || !opt.value) return null;
  const id = opt.value.trim();
  if (!id) return null;
  const meta = {
    id,
    name: (opt.dataset?.name || opt.text || '').trim(),
    vehicleNumber: (opt.dataset?.vehicle || '').trim()
  };
  if (!meta.vehicleNumber) {
    const fallback = lookupMachineMetaById(id);
    if (fallback?.vehicleNumber) meta.vehicleNumber = fallback.vehicleNumber.trim();
  }
  return meta;
}

function applyVehicleBinding(meta) {
  if (!vehicleField) return;
  if (meta && meta.vehicleNumber) {
    const previous = vehicleField.value;
    vehicleField.value = meta.vehicleNumber;
    vehicleField.readOnly = true;
    vehicleField.setAttribute('aria-readonly', 'true');
    vehicleField.dataset.boundMachineId = meta.id || '';
    if (vehicleField.value !== previous) {
      try {
        vehicleField.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {}
    }
  } else if (meta) {
    vehicleField.dataset.boundMachineId = meta.id || '';
    vehicleField.readOnly = false;
    vehicleField.removeAttribute('aria-readonly');
  } else {
    vehicleField.dataset.boundMachineId = '';
    vehicleField.readOnly = false;
    vehicleField.removeAttribute('aria-readonly');
  }
}

function syncVehicleFieldFromSelection() {
  const meta = getSelectedMachineMeta();
  if (!meta) {
    if (vehicleField) {
      if (vehicleField.dataset.boundMachineId) {
        const prev = vehicleField.value;
        vehicleField.value = '';
        if (prev) {
          try {
            vehicleField.dispatchEvent(new Event('input', { bubbles: true }));
          } catch {}
        }
      }
      vehicleField.dataset.boundMachineId = '';
      vehicleField.readOnly = false;
      vehicleField.removeAttribute('aria-readonly');
    }
    return;
  }
  applyVehicleBinding(meta);
}

// 預設表單日期為『今天』（本地時區），避免新增後『今日簽單』不計入
function pad(n){ return String(n).padStart(2,'0'); }
function localDateStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function setFormDateToToday(el = dateInput) {
  if (!el) return;
  el.value = localDateStr();
}

fetchUserContext().then(ctx => {
  if (ctx?.role === 'driver') enforceDriverUiLock(ctx);
}).catch(err => console.warn('[Delivery] enforceDriverUiLock failed', err));

if (machineField) {
  machineField.addEventListener('change', () => {
    syncVehicleFieldFromSelection();
  });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('machine-catalog-updated', () => {
    syncVehicleFieldFromSelection();
  });
}

setFormDateToToday();
document.addEventListener('DOMContentLoaded', () => setFormDateToToday());
window.addEventListener('pageshow', () => setFormDateToToday());
document.addEventListener('DOMContentLoaded', () => {
  syncVehicleFieldFromSelection();
});
if (document.readyState !== 'loading') {
  syncVehicleFieldFromSelection();
}
form?.addEventListener('reset', () => {
  // wait for native reset to finish before overriding the value
  setTimeout(() => setFormDateToToday(), 0);
  if (vehicleField) {
    setTimeout(() => {
      vehicleField.readOnly = false;
      vehicleField.removeAttribute('aria-readonly');
      vehicleField.dataset.boundMachineId = '';
    }, 0);
  }
});

async function waitForFlags(timeout = 1000) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 50));
  }
  return window.APP_FLAGS;
}

function catalogLookupByName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  const catalog = Array.isArray(window.__EAS_DRIVER_CATALOG) ? window.__EAS_DRIVER_CATALOG : [];
  return catalog.find(entry => entry?.displayName === trimmed || entry?.name === trimmed) || null;
}

function collectSelectedDrivers() {
  const results = new Map();
  const addDriver = (rawId, rawName, extras = {}) => {
    const name = (rawName || '').trim();
    if (!name) return;
    const id = (rawId || '').trim();
    const key = id || `name:${name}`;
    if (results.has(key)) return;
    let fromCatalog = null;
    if (!id || !extras.docId || !extras.email) {
      fromCatalog = catalogLookupByName(name);
    }
    const resolvedId = id || fromCatalog?.id || '';
    const payload = {
      id: resolvedId,
      name,
      displayName: extras.displayName || fromCatalog?.displayName || name,
      docId: extras.docId || fromCatalog?.docId || null,
      email: extras.email || fromCatalog?.email || null
    };
    results.set(key, payload);
  };

  const multiChecks = document.querySelectorAll('#driversOptions input[type="checkbox"]:checked');
  multiChecks.forEach(cb => {
    addDriver(cb.dataset.uid || cb.dataset.id || '', cb.dataset.display || cb.dataset.name || cb.value || '', {
      displayName: cb.dataset.display || cb.dataset.name || '',
      docId: cb.dataset.docId || '',
      email: cb.dataset.email || ''
    });
  });

  if (driverField) {
    const tag = driverField.tagName?.toLowerCase();
    if (tag === 'select') {
      const opt = driverField.options[driverField.selectedIndex];
      if (opt && opt.value) {
        addDriver(opt.dataset.uid || opt.dataset.id || '', opt.dataset.display || opt.dataset.name || opt.textContent || opt.value, {
          displayName: opt.dataset.display || opt.dataset.name || opt.textContent || opt.value,
          docId: opt.dataset.docId || '',
          email: opt.dataset.email || ''
        });
      }
    } else {
      const value = driverField.value ? driverField.value.trim() : '';
      if (value) {
        const catalog = catalogLookupByName(value);
        addDriver(catalog?.id || '', value, {
          displayName: catalog?.displayName || value,
          docId: catalog?.docId || '',
          email: catalog?.email || ''
        });
      }
    }
  }

  return Array.from(results.values());
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
  const context = await fetchUserContext();
  const uid = context?.uid || context?.user?.uid || null;
  const role = context?.role || null;
  const user = context?.user || null;
  const profile = context?.profile || null;
  const creatorUid = uid || null;
  const creatorRole = role || null;
  const creatorEmail = profile?.email || user?.email || null;
  const creatorEmailLower = (creatorEmail || '').toLowerCase();
  const creatorName = profile?.displayName || user?.displayName || null;
  const quantityValue = (baseData && typeof baseData.quantity !== 'undefined') ? Number(baseData.quantity) : null;

  const matchesCreatorEntry = (entry) => {
    if (!entry) return false;
    const rawId = entry.id ?? entry.uid ?? null;
    let entryId = '';
    if (typeof rawId === 'string') {
      entryId = rawId.trim();
    } else if (rawId) {
      entryId = String(rawId).trim();
    }
    if (entryId && creatorUid && entryId === creatorUid) return true;
    const entryEmailLower = (entry.email || '').toLowerCase();
    if (creatorEmailLower && entryEmailLower && entryEmailLower === creatorEmailLower) return true;
    if (creatorEmailLower && entryId) {
      const entryIdLower = entryId.toLowerCase();
      if (entryIdLower === creatorEmailLower) return true;
      if (entryIdLower === `email:${creatorEmailLower}`) return true;
    }
    return false;
  };

  let selectedDrivers = collectSelectedDrivers().filter(Boolean);
  let shouldDropCreatorFromAssignment = false;

  if (creatorRole === 'driver') {
    const selfDriver = resolveSelfDriverEntry(context);
    const normalized = selfDriver ? { ...selfDriver } : null;
    const fallbackName = creatorName || (creatorEmail ? creatorEmail.split('@')[0] : '目前司機');
    if (normalized) {
      normalized.id = normalized.id || creatorUid || normalized.id;
      normalized.displayName = normalized.displayName || fallbackName;
      normalized.name = normalized.displayName;
      normalized.email = normalized.email || creatorEmail || null;
    }
    selectedDrivers = normalized ? [normalized] : [{
      id: creatorUid || '',
      name: fallbackName,
      displayName: fallbackName,
      docId: null,
      email: creatorEmail || null
    }];
    if (driverField) {
      const chosen = selectedDrivers[0]?.displayName || selectedDrivers[0]?.name || fallbackName;
      driverField.value = chosen;
    }
  } else if (selectedDrivers.length) {
    const hasOtherDriver = selectedDrivers.some(entry => entry && !matchesCreatorEntry(entry));
    if (hasOtherDriver) {
      selectedDrivers = selectedDrivers.filter(entry => entry && !matchesCreatorEntry(entry));
      shouldDropCreatorFromAssignment = true;
    }
  }

  selectedDrivers = selectedDrivers.filter(Boolean);

  let driverIds = selectedDrivers.map(d => d?.id).filter(Boolean);
  if (creatorRole === 'driver' && creatorUid && !driverIds.includes(creatorUid)) {
    driverIds.push(creatorUid);
  }
  driverIds = Array.from(new Set(driverIds));
  const assignedSet = new Set(driverIds);
  if (creatorRole === 'driver' && creatorUid) {
    assignedSet.add(creatorUid);
  }
  if (shouldDropCreatorFromAssignment && creatorUid) {
    assignedSet.delete(creatorUid);
    if (creatorEmailLower) {
      const emailKey = `email:${creatorEmailLower}`;
      assignedSet.delete(emailKey);
      assignedSet.delete(creatorEmailLower);
    }
  }
  const assignedTo = Array.from(assignedSet);
  const readableBy = Array.from(new Set([...assignedSet, creatorUid].filter(Boolean)));

  const data = {
    localId: crypto.randomUUID(),
    ...baseData,
    signatureStatus: baseData.signatureStatus || 'pending',
    // 預設為待收款（供首頁「待收款」統計使用）
    paidAt: null,
    quantity: Number.isFinite(quantityValue) ? Number(quantityValue) : null,
    createdAt: new Date().toISOString(),
    createdBy: creatorUid,
    createdByRole: creatorRole,
    createdByEmail: creatorEmail,
    createdByName: creatorName,
    assignedTo,
    readableBy,
    drivers: selectedDrivers,
    driverIds
  };
  if (!data.driverName && selectedDrivers.length) {
    data.driverName = selectedDrivers[0].displayName || selectedDrivers[0].name;
  }
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
