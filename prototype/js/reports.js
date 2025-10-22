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
const filterDriver = document.getElementById('filterDriver');
const sortableHeaders = Array.from(document.querySelectorAll('th.sortable'));

const state = {
  allRows: [],
  filteredRows: [],
  viewRows: [],
  sortKey: 'date',
  sortDirection: 'desc'
};

const CSV_HEADERS = [
  'date',
  'customer',
  'item',
  'origin',
  'destination',
  'quantity',
  'unit',
  'amount',
  'receivedCash',
  'modelName',
  'driverName',
  'vehicleNumber'
];

// 匯出時顯示的中文表頭（順序需與 CSV_HEADERS 對應）
const EXPORT_LABELS_ZH = [
  '日期', '客戶', '物品', '起點', '訖點', '數量', '單位', '金額', '已收現金', '型號/品名', '司機姓名', '車號'
];

init();

async function init() {
  updateDataSourceBadge();
  bindEvents();

  try {
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
  const rows = loadMockReportRows().map(row => adaptDeliveryNoteToReportRow(row));
  return rows;
}

async function fetchFirestoreRows() {
  try {
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
    const machines = await listAllMachines();
    if (!Array.isArray(machines)) return [];
    const names = machines.map(m => m.name || '').filter(Boolean);
    return names.length ? names : rows.map(r => r.modelName).filter(Boolean);
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

  applySort();
  renderTable();
  updateSortIndicators();
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
      <td>${row.unit || '-'}</td>
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
      <td colspan="12" class="text-center text-muted py-4">${message}</td>
    </tr>
  `;
  updateFooter();
}

function updateFooter() {
  if (!tableFooter) return;
  const total = state.allRows.length;
  const filtered = state.filteredRows.length;
  const visible = state.viewRows.length;
  tableFooter.textContent = `共 ${visible} 筆資料（篩選後 ${filtered} / 總計 ${total}）`;
}

function renderReceivedCash(received) {
  if (received === true) {
    return '<span class="badge bg-success"><i class="bi bi-cash-coin me-1"></i>已收</span>';
  }
  return '<span class="badge bg-secondary"><i class="bi bi-clock-history me-1"></i>待收</span>';
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
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
    modelName: note.modelName ?? note.machineName ?? note.machineModel ?? '',
    driverName: note.driverName ?? note.driver?.name ?? note.driver ?? '',
    vehicleNumber: note.vehicleNumber ?? note.vehicle?.number ?? note.vehiclePlate ?? '',
    paidAt: note.paidAt ?? null
  };
}

function normalizeDateValue(value) {
  if (!value) return { value: null, display: '' };
  let dateObj = null;
  if (value instanceof Date) {
    dateObj = new Date(value.getTime());
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    dateObj = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (typeof value.toDate === 'function') {
    try {
      dateObj = value.toDate();
    } catch {
      dateObj = null;
    }
  }
  if (!dateObj) return { value: null, display: '' };
  dateObj.setHours(0, 0, 0, 0);
  const display = dateObj.toISOString().slice(0, 10);
  return { value: dateObj, display };
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
  // 為了讓 Excel 更可靠地分欄，使用 Tab 分隔（TSV）並輸出為 UTF-16LE
  const DELIM = '\t';
  // header 使用中文標題
  const headerLine = EXPORT_LABELS_ZH.join(DELIM);
  // 針對 TSV 使用較簡單的序列化：移除 tab/newline，保留原始內容（不包引號）
  const rows = state.viewRows.map(row => CSV_HEADERS.map(key => serializeForTsv(row[key])));
  const csvLines = [headerLine, ...rows.map(cols => cols.join(DELIM))];
  const csvContent = csvLines.join('\r\n');

  // Debug: 印出要輸出的前 1K 內容（把 tab/newline 可視化）
  try {
    console.log('[Reports] Export preview (header):', headerLine.replace(/\t/g,'[\\t]'));
    console.log('[Reports] Export preview (first row):', (rows[0] || []).join(DELIM).replace(/\t/g,'[\\t]').slice(0, 1000));
    console.log('[Reports] Raw preview (escaped):', csvContent.slice(0, 1000).replace(/\t/g,'[\\t]').replace(/\r?\n/g,'[\\n]'));
  } catch (e) { /* ignore debug errors */ }
  // 為了讓 Excel (Windows) 正確顯示中文，使用 UTF-16LE 編碼並加上 BOM (0xFF 0xFE)
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
    // 若環境不支援，上回退到 UTF-8 BOM
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
    '單位': r.unit || '',
    '金額': r.amount ?? '',
    '已收現金': r.receivedCash ? '是' : '否',
    '型號/品名': r.modelName || '',
    '司機姓名': r.driverName || '',
    '車號': r.vehicleNumber || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_LABELS_ZH });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '報表');
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
