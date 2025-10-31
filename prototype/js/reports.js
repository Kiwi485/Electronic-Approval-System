import { listAllDrivers, listAllMachines } from './api/index.js';
import { loadMockReportRows } from './reports-mock-data.js';

// 動態判斷是否使用 Mock（避免在模組載入時鎖定）
function shouldUseMock() { return (window.APP_FLAGS?.USE_MOCK_DATA ?? true) === true; }
const dataSourceBadge = document.getElementById('dataSourceBadge');
const exportButton = document.getElementById('exportCsvBtn');
const tableBody = document.getElementById('reportTableBody');
const tableFooter = document.getElementById('tableFooter');
const filterDateStart = document.getElementById('filterDateStart');
const filterDateEnd = document.getElementById('filterDateEnd');
const filterCustomer = document.getElementById('filterCustomer');
const filterMachine = document.getElementById('filterMachine');
const MACHINE_PLACEHOLDER_REGEX = /選擇機具/;
const filterDriver = document.getElementById('filterDriver');
const sortableHeaders = Array.from(document.querySelectorAll('th.sortable'));
const customerSummaryBody = document.getElementById('customerSummaryBody');
const customerSummaryFooter = document.getElementById('customerSummaryFooter');
const machineCatalog = {
  map: new Map(),        // exact id -> display name
  alias: new Map(),      // normalized alias -> display name
  aliasToId: new Map(),  // normalized alias -> canonical id
  loaded: false,
  lastError: null
};

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function normalizeAlias(value) {
  const str = normalizeId(value);
  return str ? str.toLowerCase() : null;
}

function equalsIgnoreCase(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function lookupMachineName(key) {
  if (!key) return '';
  const exact = normalizeId(key);
  if (exact && machineCatalog.map.has(exact)) {
    return machineCatalog.map.get(exact) || '';
  }
  const aliasKey = normalizeAlias(key);
  if (aliasKey && machineCatalog.alias.has(aliasKey)) {
    return machineCatalog.alias.get(aliasKey) || '';
  }
  return '';
}

function findCatalogIdByAlias(value) {
  const aliasKey = normalizeAlias(value);
  if (!aliasKey) return null;
  return machineCatalog.aliasToId.get(aliasKey) || null;
}

const state = {
  allRows: [],
  filteredRows: [],
  viewRows: [],
  sortKey: 'date',
  sortDirection: 'desc',
  customerSummaryRows: [],
  customerSummaryTotals: { customers: 0, count: 0, receivedCount: 0, amount: 0 }
};

const CSV_HEADERS = [
  'date',
  'customer',
  'item',
  'origin',
  'destination',
  'quantity',
  'amount',
  'receivedCash',
  'modelName',
  'driverName',
  'vehicleNumber'
];

// 匯出時顯示的中文表頭（順序需與 CSV_HEADERS 對應）
const EXPORT_LABELS_ZH = [
  '日期', '客戶', '物品', '起點', '訖點', '數量', '金額', '收款狀態', '型號/品名', '司機姓名', '車號'
];

const SUMMARY_HEADERS = ['customer', 'count', 'receivedCount', 'amount'];
const SUMMARY_LABELS_ZH = ['客戶', '簽單數', '已收款數', '總金額'];

const CSV_INDEX = CSV_HEADERS.reduce((map, key, idx) => {
  map[key] = idx;
  return map;
}, {});

init();

async function init() {
  updateDataSourceBadge();
  bindEvents();

  try {
    await ensureMachineCatalog();
    const rows = shouldUseMock() ? await fetchMockRows() : await fetchFirestoreRows();
    state.allRows = rows;
    await prepareFilterOptions(rows);
    applyFilters();
  } catch (error) {
    console.error('報表資料初始化失敗', error);
    renderErrorRow('載入資料失敗，請稍後再試');
  } finally {
    document.documentElement.style.visibility = 'visible';
  }
}

function updateDataSourceBadge() {
  if (!dataSourceBadge) return;
  const modeLabel = shouldUseMock() ? 'Mock 資料' : 'Firestore';
  dataSourceBadge.textContent = `來源：${modeLabel}`;
}

// 若透過 console 動態改變 window.APP_FLAGS，會建議在 console 觸發一個事件
// 例如： window.APP_FLAGS.USE_MOCK_DATA = true; window.dispatchEvent(new CustomEvent('appflagschange'));
// 下面的 listener 會在同 tab 中回應這個事件並更新 badge
window.addEventListener('appflagschange', () => {
  try { updateDataSourceBadge(); } catch (e) { /* ignore */ }
});

function bindEvents() {
  exportButton?.addEventListener('click', async (e) => {
    // 優先使用 xlsx 匯出（更穩定），若失敗再回退到 TSV
    try {
      await exportXlsx();
    } catch (err) {
      console.warn('[Reports] exportXlsx 失敗，回退到 TSV export', err);
      handleExportCsv();
    }
  });
  [filterDateStart, filterDateEnd, filterCustomer, filterMachine, filterDriver]
    .filter(Boolean)
    .forEach(el => el.addEventListener('change', applyFilters));

  sortableHeaders.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDirection = key === 'date' ? 'desc' : 'asc';
      }
      applySort();
      renderTable();
      updateSortIndicators();
    });
  });
}

// 支援跨 tab 更新：監聽 storage 事件（reports-mock-data.js 會寫入 LOCAL_UPDATE_KEY）
window.addEventListener('storage', (e) => {
  if (!shouldUseMock()) return;
  if (!e?.key) return;
  if (e.key === 'mock_delivery_notes_v1' || e.key === 'mock_delivery_notes_v1_last_update') {
    // 重新載入 mock 資料
    window.dispatchEvent(new CustomEvent('mock-report-updated'));
  }
});

// 同一頁面內的 mock 更新事件（saveMockReportRow 會 dispatch）
window.addEventListener('mock-report-updated', async (e) => {
  if (!shouldUseMock()) return;
  try {
    const rows = await fetchMockRows();
    state.allRows = rows;
    await prepareFilterOptions(rows);
    applyFilters();
  } catch (err) {
    console.warn('[Reports] 處理 mock-report-updated 事件失敗', err);
  }
});

async function fetchMockRows() {
  await ensureMachineCatalog();
  const rows = loadMockReportRows().map(row => adaptDeliveryNoteToReportRow(row));
  return rows;
}

async function fetchFirestoreRows() {
  try {
    await ensureMachineCatalog();
    const { db } = await import('../firebase-init.js');
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js');
    const snap = await getDocs(collection(db, 'deliveryNotes'));
    const rows = [];
    snap.forEach(doc => {
      const note = doc.data();
      rows.push(adaptDeliveryNoteToReportRow({ id: doc.id, ...note }));
    });
    return rows;
  } catch (error) {
    console.warn('讀取 Firestore 報表資料失敗，將顯示空清單', error);
    return [];
  }
}

async function prepareFilterOptions(rows) {
  populateCustomerOptions(rows);
  const [machines, drivers] = await Promise.all([
    loadMachineOptions(rows).catch(() => []),
    loadDriverOptions(rows).catch(() => [])
  ]);
  populateSelectDistinct(filterMachine, machines.length ? machines : rows.map(r => r.modelName).filter(Boolean));
  populateSelectDistinct(filterDriver, drivers.length ? drivers : rows.map(r => r.driverName).filter(Boolean));
}

function populateCustomerOptions(rows) {
  populateSelectDistinct(filterCustomer, rows.map(row => row.customer).filter(Boolean));
}

async function loadMachineOptions(rows) {
  try {
    await ensureMachineCatalog();
    const names = Array.from(machineCatalog.map.values()).filter(Boolean);
    if (names.length) return names;
    return rows.map(r => r.modelName).filter(Boolean);
  } catch (error) {
    console.warn('載入機具選項失敗', error);
    return rows.map(r => r.modelName).filter(Boolean);
  }
}

async function loadDriverOptions(rows) {
  try {
    const drivers = await listAllDrivers();
    if (!Array.isArray(drivers)) return [];
    const names = drivers.map(d => d.displayName || '').filter(Boolean);
    return names.length ? names : rows.map(r => r.driverName).filter(Boolean);
  } catch (error) {
    console.warn('載入司機選項失敗', error);
    return rows.map(r => r.driverName).filter(Boolean);
  }
}

function populateSelectDistinct(selectEl, values) {
  if (!selectEl) return;
  const unique = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const existing = new Set();
  Array.from(selectEl.options).forEach(opt => existing.add(opt.value));
  unique.forEach(value => {
    if (existing.has(value)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

function applyFilters() {
  const start = parseDate(filterDateStart?.value, 'start');
  const end = parseDate(filterDateEnd?.value, 'end');
  const customerVal = filterCustomer?.value || '';
  const machineVal = filterMachine?.value || '';
  const driverVal = filterDriver?.value || '';

  state.filteredRows = state.allRows.filter(row => {
    if (start && row._date && row._date < start) return false;
    if (end && row._date && row._date > end) return false;
    if (customerVal && row.customer !== customerVal) return false;
    if (machineVal && row.modelName !== machineVal) return false;
    if (driverVal && row.driverName !== driverVal) return false;
    return true;
  });

  const summary = computeCustomerSummary(state.filteredRows);
  state.customerSummaryRows = summary.rows;
  state.customerSummaryTotals = summary.totals;

  applySort();
  renderTable();
  updateSortIndicators();
  renderCustomerSummary();
}

function applySort() {
  const { sortKey, sortDirection } = state;
  const multiplier = sortDirection === 'asc' ? 1 : -1;
  const comparer = createComparer(sortKey);
  state.viewRows = [...state.filteredRows].sort((a, b) => comparer(a, b) * multiplier);
}

function createComparer(key) {
  switch (key) {
    case 'date':
      return (a, b) => (a._date?.getTime() || 0) - (b._date?.getTime() || 0);
    case 'quantity':
    case 'amount':
      return (a, b) => (a[key] || 0) - (b[key] || 0);
    case 'receivedCash':
      return (a, b) => Number(a.receivedCash) - Number(b.receivedCash);
    default:
      return (a, b) => (a[key] || '').localeCompare(b[key] || '', 'zh-Hant');
  }
}

function updateSortIndicators() {
  sortableHeaders.forEach(th => {
    const indicator = th.querySelector('.sort-indicator');
    if (!indicator) return;
    if (th.dataset.sortKey === state.sortKey) {
      indicator.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      th.classList.add('table-active');
    } else {
      indicator.textContent = '';
      th.classList.remove('table-active');
    }
  });
}

function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (state.viewRows.length === 0) {
    renderErrorRow('目前無符合條件的資料');
    return;
  }

  const fragment = document.createDocumentFragment();
  state.viewRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.date || '-'}</td>
      <td>${row.customer || '-'}</td>
      <td>${row.item || '-'}</td>
      <td>${row.origin || '-'}</td>
      <td>${row.destination || '-'}</td>
      <td class="text-end">${formatNumber(row.quantity)}</td>
      <td class="text-end">${formatCurrency(row.amount)}</td>
      <td>${renderReceivedCash(row.receivedCash)}</td>
      <td>${row.modelName || '-'}</td>
      <td>${row.driverName || '-'}</td>
      <td>${row.vehicleNumber || '-'}</td>
    `;
    fragment.appendChild(tr);
  });
  tableBody.appendChild(fragment);
  updateFooter();
}

function renderErrorRow(message) {
  if (!tableBody) return;
  tableBody.innerHTML = `
    <tr>
      <td colspan="11" class="text-center text-muted py-4">${message}</td>
    </tr>
  `;
  updateFooter();
  renderCustomerSummary(true);
}

function updateFooter() {
  if (!tableFooter) return;
  const total = state.allRows.length;
  const filtered = state.filteredRows.length;
  const visible = state.viewRows.length;
  tableFooter.textContent = `共 ${visible} 筆資料（篩選後 ${filtered} / 總計 ${total}）`;
}

function renderCustomerSummary(forceEmpty = false) {
  if (!customerSummaryBody || !customerSummaryFooter) return;

  if (forceEmpty || state.customerSummaryRows.length === 0) {
    customerSummaryBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-3">目前沒有統計資料</td>
      </tr>
    `;
    customerSummaryFooter.textContent = '總計 0 個客戶';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.customerSummaryRows.forEach(entry => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.customer || '（未填寫）'}</td>
      <td class="text-end">${formatInteger(entry.count)}</td>
      <td class="text-end">${formatInteger(entry.receivedCount)}</td>
      <td class="text-end">${formatCurrency(entry.amount)}</td>
    `;
    fragment.appendChild(tr);
  });
  customerSummaryBody.innerHTML = '';
  customerSummaryBody.appendChild(fragment);

  const totals = state.customerSummaryTotals;
  const totalCustomers = totals.customers;
  const totalCount = formatInteger(totals.count);
  const received = formatInteger(totals.receivedCount);
  const amount = formatCurrency(totals.amount);
  customerSummaryFooter.textContent = `總計 ${totalCustomers} 個客戶｜簽單 ${totalCount} 筆｜已收款 ${received} 筆｜總金額 ${amount}`;
}

function renderReceivedCash(received) {
  if (received === true) {
    return '<span class="badge bg-success"><i class="bi bi-cash-coin me-1"></i>已收款</span>';
  }
  return '<span class="badge bg-secondary"><i class="bi bi-clock-history me-1"></i>待收款</span>';
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `NT$ ${Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

function parseDate(input, mode) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  if (mode === 'start') {
    date.setHours(0, 0, 0, 0);
  } else if (mode === 'end') {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

// 統一轉換 Firestore / Mock 符合規格的資料列
function adaptDeliveryNoteToReportRow(note = {}) {
  const normalizedDate = normalizeDateValue(note.date ?? note.serverCreatedAt ?? note.createdAt ?? null);
  const quantity = toNumberOrNull(note.quantity ?? note.amountQuantity ?? null);
  const amount = toNumberOrNull(note.amount ?? note.totalAmount ?? null);
  const received = normalizeReceivedCash(note);
  const machineIdRaw = note.machineId ?? note.machine?.id ?? null;
  let machineId = machineIdRaw != null ? normalizeId(machineIdRaw) : null;
  const modelSource = note.modelName
    ?? note.machineName
    ?? note.machine?.name
    ?? note.machineModel
    ?? (typeof note.machine === 'string' ? note.machine : '')
    ?? '';
  let modelName = typeof modelSource === 'string' ? modelSource.trim() : (modelSource ? String(modelSource).trim() : '');
  if (modelName && MACHINE_PLACEHOLDER_REGEX.test(modelName)) modelName = '';
  const modelAlias = normalizeId(modelName);

  if (!machineId && modelAlias) {
    const guessedId = findCatalogIdByAlias(modelAlias) || findCatalogIdByAlias(modelName);
    if (guessedId) machineId = guessedId;
  }

  const nameFromCatalogById = lookupMachineName(machineId);
  const nameFromCatalogByModel = lookupMachineName(modelAlias || modelName);

  if (!modelName && nameFromCatalogById) {
    modelName = nameFromCatalogById;
  } else if (nameFromCatalogById && equalsIgnoreCase(modelName, machineId)) {
    modelName = nameFromCatalogById;
  } else if (nameFromCatalogByModel) {
    modelName = nameFromCatalogByModel;
  }

  if (modelName && MACHINE_PLACEHOLDER_REGEX.test(modelName)) {
    modelName = '';
  }

  return {
    id: note.id || note.localId || null,
    date: normalizedDate.display,
    _date: normalizedDate.value,
    customer: note.customer ?? note.customerName ?? note.client ?? '',
    item: note.item ?? note.purpose ?? '',
    origin: note.origin ?? note.startPoint ?? '',
    destination: note.destination ?? note.endPoint ?? '',
    quantity: quantity ?? 0,
    unit: note.unit ?? note.quantityUnit ?? '',
    amount: amount ?? 0,
    receivedCash: received,
    modelName,
    machineId,
    driverName: note.driverName ?? note.driver?.name ?? note.driver ?? '',
    vehicleNumber: note.vehicleNumber ?? note.vehicle?.number ?? note.vehiclePlate ?? '',
    paidAt: note.paidAt ?? null
  };
}

async function ensureMachineCatalog(force = false) {
  if (machineCatalog.loaded && !force) return machineCatalog.map;
  try {
    const machines = await listAllMachines();
    machineCatalog.map.clear();
    machineCatalog.alias.clear();
    machineCatalog.aliasToId.clear();
    if (Array.isArray(machines)) {
      machines.forEach(machine => {
        if (!machine) return;
        const idRaw = machine.id ?? machine.machineId ?? machine.uid ?? machine.code ?? null;
        const idKey = normalizeId(idRaw);
        if (!idKey) return;
        const displayName = [machine.displayName, machine.modelName, machine.name, machine.label, machine.title, machine.alias]
          .map(v => (typeof v === 'string') ? v.trim() : '')
          .find(text => text && text.length > 0) || idKey;

        machineCatalog.map.set(idKey, displayName);

        const canonicalAlias = normalizeAlias(idKey);
        if (canonicalAlias) {
          machineCatalog.alias.set(canonicalAlias, displayName);
          machineCatalog.aliasToId.set(canonicalAlias, idKey);
        }

        const aliasCandidates = [
          machine.name,
          machine.displayName,
          machine.modelName,
          machine.code,
          machine.alias,
          machine.label,
          machine.title
        ];

        aliasCandidates.forEach(candidate => {
          const aliasKey = normalizeAlias(candidate);
          if (!aliasKey) return;
          if (!machineCatalog.alias.has(aliasKey)) {
            machineCatalog.alias.set(aliasKey, displayName);
          }
          if (!machineCatalog.aliasToId.has(aliasKey)) {
            machineCatalog.aliasToId.set(aliasKey, idKey);
          }
        });
      });
    }
    machineCatalog.loaded = true;
    machineCatalog.lastError = null;
  } catch (err) {
    machineCatalog.lastError = err;
    console.warn('[Reports] 載入機具清單失敗（catalog）', err);
  }
  return machineCatalog.map;
}

function normalizeDateValue(value) {
  if (!value) return { value: null, display: '' };
  const pad = (n) => String(n).padStart(2, '0');
  const buildResult = (dateObj) => {
    if (!dateObj) return { value: null, display: '' };
    const normalized = new Date(dateObj.getTime());
    normalized.setHours(0, 0, 0, 0);
    const display = `${normalized.getFullYear()}-${pad(normalized.getMonth() + 1)}-${pad(normalized.getDate())}`;
    return { value: normalized, display };
  };

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const pureDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (pureDateMatch) {
      const [, y, m, d] = pureDateMatch;
      const normalized = new Date(Number(y), Number(m) - 1, Number(d));
      normalized.setHours(0, 0, 0, 0);
      return { value: normalized, display: trimmed };
    }
  }

  let dateObj = null;
  if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    dateObj = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (value && typeof value.toDate === 'function') {
    try {
      dateObj = value.toDate();
    } catch {
      dateObj = null;
    }
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    dateObj = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return buildResult(dateObj);
}

function normalizeReceivedCash(note) {
  if (typeof note.receivedCash === 'boolean') return note.receivedCash;
  const paidAt = note.paidAt;
  if (!paidAt) return false;
  if (typeof paidAt === 'string') return paidAt.trim().length > 0;
  if (paidAt instanceof Date) return true;
  if (typeof paidAt.toDate === 'function') {
    try {
      return !!paidAt.toDate();
    } catch {
      return false;
    }
  }
  return Boolean(paidAt);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function handleExportCsv() {
  if (!state.viewRows.length) {
    console.info('無資料可匯出');
    return;
  }
  const DELIM = '\t';
  const headerLine = EXPORT_LABELS_ZH.join(DELIM);
  const detailRows = state.viewRows.map(row => CSV_HEADERS.map(key => serializeForTsv(transformExportValue(row, key))));
  const csvLines = [headerLine, ...detailRows.map(cols => cols.join(DELIM))];

  if (state.customerSummaryRows.length) {
    const summaryDetailRows = state.customerSummaryRows.map(entry => buildSummaryDetailRow(entry));
    summaryDetailRows.push(buildSummaryTotalsRow(state.customerSummaryTotals));
    const summaryDetailLines = summaryDetailRows.map(row => row.map(value => serializeForTsv(value)).join(DELIM));
    csvLines.push('');
    csvLines.push(...summaryDetailLines);

    csvLines.push('');
    csvLines.push('客戶統計');
    csvLines.push(SUMMARY_LABELS_ZH.join(DELIM));
    state.customerSummaryRows.forEach(entry => {
      const cols = SUMMARY_HEADERS.map(key => serializeForTsv(transformSummaryExportValue(entry, key)));
      csvLines.push(cols.join(DELIM));
    });
    const totals = state.customerSummaryTotals;
    const totalLine = [
      '總計',
      totals.count,
      totals.receivedCount,
      Number((Number(totals.quantity) || 0).toFixed(2)),
      Number((Number(totals.amount) || 0).toFixed(0))
    ].map(serializeForTsv).join(DELIM);
    csvLines.push(totalLine);
  }

  const csvContent = csvLines.join('\r\n');

  try {
    console.log('[Reports] Export preview (detail header):', headerLine.replace(/\t/g,'[\\t]'));
    console.log('[Reports] Export preview (first row):', (detailRows[0] || []).join(DELIM).replace(/\t/g,'[\\t]').slice(0, 1000));
  } catch (e) { /* ignore debug logs */ }

  try {
    const bom = new Uint8Array([0xFF, 0xFE]);
    const buf = new ArrayBuffer(csvContent.length * 2);
    const view = new Uint8Array(buf);
    for (let i = 0; i < csvContent.length; i++) {
      const code = csvContent.charCodeAt(i);
      view[i * 2] = code & 0xFF;
      view[i * 2 + 1] = (code >> 8) & 0xFF;
    }
    var blob = new Blob([bom, view], { type: 'text/tab-separated-values;charset=utf-16le;' });
  } catch (e) {
    const bomPrefixed = '\uFEFF' + csvContent;
    var blob = new Blob([bomPrefixed], { type: 'text/tab-separated-values;charset=utf-8;' });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  link.href = url;
  link.download = `reports-${timestamp}.tsv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 匯出為 Excel (.xlsx)，使用 SheetJS（動態載入 CDN）
async function exportXlsx() {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  // 將目前 viewRows 轉為 JSON 並以中文標頭輸出
  const rows = state.viewRows.map(r => ({
    '日期': r.date || '',
    '客戶': r.customer || '',
    '物品': r.item || '',
    '起點': r.origin || '',
    '訖點': r.destination || '',
    '數量': r.quantity ?? '',
    '金額': r.amount ?? '',
    '收款狀態': r.receivedCash ? '已收款' : '待收款',
    '型號/品名': r.modelName || '-',
    '司機姓名': r.driverName || '',
    '車號': r.vehicleNumber || ''
  }));
  if (state.customerSummaryRows.length) {
    rows.push({
      '日期': '',
      '客戶': '客戶彙總',
      '物品': '',
      '起點': '',
      '訖點': '',
      '數量': '',
      '金額': '',
      '收款狀態': '',
      '型號/品名': '',
      '司機姓名': '',
      '車號': ''
    });
    state.customerSummaryRows.forEach(entry => {
      rows.push({
        '日期': '',
        '客戶': `${entry.customer || '（未填寫）'} (總計)`,
        '物品': `簽單 ${formatInteger(entry.count)} 筆 / 已收款 ${formatInteger(entry.receivedCount)} 筆`,
        '起點': '',
        '訖點': '',
        '數量': '',
        '金額': Number((Number(entry.amount) || 0).toFixed(0)),
        '收款狀態': '',
        '型號/品名': '',
        '司機姓名': '',
        '車號': ''
      });
    });
    rows.push({
      '日期': '',
      '客戶': '所有客戶 (總計)',
      '物品': `簽單 ${formatInteger(state.customerSummaryTotals.count)} 筆 / 已收款 ${formatInteger(state.customerSummaryTotals.receivedCount)} 筆`,
      '起點': '',
      '訖點': '',
      '數量': '',
      '金額': Number((Number(state.customerSummaryTotals.amount) || 0).toFixed(0)),
      '收款狀態': '',
      '型號/品名': '',
      '司機姓名': '',
      '車號': ''
    });
  }
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_LABELS_ZH });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '報表');
  if (state.customerSummaryRows.length) {
    const summaryRows = state.customerSummaryRows.map(entry => ({
      '客戶': entry.customer || '（未填寫）',
      '簽單數': entry.count,
      '已收款數': entry.receivedCount,
      '總金額': Number((Number(entry.amount) || 0).toFixed(0))
    }));
    summaryRows.push({
      '客戶': '總計',
      '簽單數': state.customerSummaryTotals.count,
      '已收款數': state.customerSummaryTotals.receivedCount,
      '總金額': Number((Number(state.customerSummaryTotals.amount) || 0).toFixed(0))
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows, { header: SUMMARY_LABELS_ZH });
    XLSX.utils.book_append_sheet(wb, wsSummary, '客戶統計');
  }
  const filename = `reports-${(new Date()).toISOString().replace(/[-:]/g,'').split('.')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function serializeForCsv(row, key) {
  const value = key === 'receivedCash'
    ? (row.receivedCash ? 'true' : 'false')
    : row[key];
  const text = value === undefined || value === null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

// TSV 序列化：移除 tab/newline，保留內容
function serializeForTsv(value) {
  if (value === undefined || value === null) return '';
  let text = String(value);
  // 將 CR/LF 及 tab 轉成一個空格，避免破壞欄位
  text = text.replace(/[\r\n\t]/g, ' ');
  return text;
}

function transformExportValue(row, key) {
  switch (key) {
    case 'receivedCash':
      return row.receivedCash ? '已收款' : '待收款';
    case 'amount':
    case 'quantity':
      return row[key] ?? '';
    default:
      return row[key];
  }
}

function transformSummaryExportValue(entry, key) {
  switch (key) {
    case 'customer':
      return entry.customer || '（未填寫）';
    case 'count':
      return entry.count;
    case 'receivedCount':
      return entry.receivedCount;
    case 'amount':
      return Number((Number(entry.amount) || 0).toFixed(0));
    default:
      return entry[key];
  }
}

function computeCustomerSummary(rows) {
  const map = new Map();
  const totals = { customers: 0, count: 0, receivedCount: 0, amount: 0 };

  rows.forEach(row => {
    const rawName = row.customer && row.customer.trim ? row.customer.trim() : row.customer;
    const name = rawName && rawName.length ? rawName : '（未填寫）';
    if (!map.has(name)) {
      map.set(name, { customer: name, count: 0, receivedCount: 0, amount: 0 });
    }
    const entry = map.get(name);
    entry.count += 1;
    entry.amount += Number(row.amount) || 0;
    if (row.receivedCash) entry.receivedCount += 1;

    totals.count += 1;
    totals.amount += Number(row.amount) || 0;
    if (row.receivedCash) totals.receivedCount += 1;
  });

  const rowsArr = Array.from(map.values()).sort((a, b) => b.amount - a.amount || a.customer.localeCompare(b.customer, 'zh-Hant'));
  totals.customers = rowsArr.length;

  return { rows: rowsArr, totals };
}

function buildSummaryDetailRow(entry) {
  const row = CSV_HEADERS.map(() => '');
  row[CSV_INDEX.customer] = `${entry.customer || '（未填寫）'} (總計)`;
  row[CSV_INDEX.item] = `簽單 ${formatInteger(entry.count)} 筆 / 已收款 ${formatInteger(entry.receivedCount)} 筆`;
  row[CSV_INDEX.amount] = Number((Number(entry.amount) || 0).toFixed(0));
  return row;
}

function buildSummaryTotalsRow(totals) {
  const row = CSV_HEADERS.map(() => '');
  row[CSV_INDEX.customer] = '所有客戶 (總計)';
  row[CSV_INDEX.item] = `簽單 ${formatInteger(totals.count)} 筆 / 已收款 ${formatInteger(totals.receivedCount)} 筆`;
  row[CSV_INDEX.amount] = Number((Number(totals.amount) || 0).toFixed(0));
  return row;
}
