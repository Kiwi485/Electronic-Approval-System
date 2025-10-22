export const REPORTS_MOCK_DATA = [
  {
    id: "r-20240401-001",
    date: "2024-04-01",
    customer: "翔宇建設",
    item: "鋼筋",
    origin: "桃園龜山廠",
    destination: "新北新店工地",
    quantity: 12,
    unit: "噸",
    amount: 56000,
    receivedCash: true,
    modelName: "PC200 挖土機",
    driverName: "王小明",
    vehicleNumber: "ABC-1234"
  },
  {
    id: "r-20240403-002",
    date: "2024-04-03",
    customer: "宏達營造",
    item: "混凝土",
    origin: "林口材料場",
    destination: "台北南港重劃區",
    quantity: 8.5,
    unit: "立方米",
    amount: 42000,
    receivedCash: false,
    paidAt: null,
    modelName: "住友吊車 S1",
    driverName: "李阿華",
    vehicleNumber: "DEF-5678"
  },
  {
    id: "r-20240408-003",
    date: "2024-04-08",
    customer: "遠翔工程",
    item: "模板",
    origin: "三重倉庫",
    destination: "板橋江翠段",
    quantity: 150,
    unit: "片",
    amount: 31800,
    receivedCash: false,
    paidAt: "2024-04-12T09:30:00+08:00",
    modelName: "Kato KR-25H",
    driverName: "王小明",
    vehicleNumber: "GHI-9012"
  },
  {
    id: "r-20240412-004",
    date: "2024-04-12",
    customer: "建德營造",
    item: "H 鋼",
    origin: "中壢鋼材倉",
    destination: "桃園捷運綠線工地",
    quantity: 25,
    unit: "支",
    amount: 88500,
    receivedCash: true,
    modelName: "PC200 挖土機",
    driverName: "林大同",
    vehicleNumber: "JKL-3456"
  },
  {
    id: "r-20240418-005",
    date: "2024-04-18",
    customer: "聯邦土木",
    item: "砂石",
    origin: "桃園大園場",
    destination: "基隆八斗子",
    quantity: 32,
    unit: "噸",
    amount: 49500,
    receivedCash: false,
    modelName: "住友吊車 S1",
    driverName: "李阿華",
    vehicleNumber: "MNO-7890"
  },
  {
    id: "r-20240421-006",
    date: "2024-04-21",
    customer: "翔宇建設",
    item: "水塔",
    origin: "新竹竹北倉庫",
    destination: "台北文山區",
    quantity: 2,
    unit: "座",
    amount: 26800,
    receivedCash: true,
    paidAt: "2024-04-21T18:10:00+08:00",
    modelName: "Sennebogen 613",
    driverName: "陳師傅",
    vehicleNumber: "PQR-2468"
  }
];

// localStorage key（版本化）
const LOCAL_STORE_KEY = 'mock_delivery_notes_v1';
const LOCAL_UPDATE_KEY = 'mock_delivery_notes_v1_last_update';

function _readLocalMock() {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY) || '[]';
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(r => ({ ...r }));
  } catch {
    return [];
  }
}

function _writeLocalMock(arr) {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(arr));
    // 同時寫入一個 timestamp key，確保不同 tab 的 storage 事件會被觸發
    try { localStorage.setItem(LOCAL_UPDATE_KEY, String(Date.now())); } catch (e) {}
    return true;
  } catch (e) {
    console.warn('[Mock] 寫入 localStorage 失敗', e);
    return false;
  }
}

export function loadMockReportRows() {
  const local = _readLocalMock();
  const staticRows = REPORTS_MOCK_DATA.map(r => ({ ...r }));
  return [...staticRows, ...local];
}

export function saveMockReportRow(row = {}) {
  try {
    const store = _readLocalMock();
    const toSave = { ...row };
    if (!toSave.id) toSave.id = `mock-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    toSave.date = toSave.date || (new Date()).toISOString().slice(0,10);
    store.push(toSave);
    const ok = _writeLocalMock(store);
    if (ok) window.dispatchEvent(new CustomEvent('mock-report-updated', { detail: { row: toSave } }));
    return ok;
  } catch (e) {
    console.warn('[Mock] saveMockReportRow 失敗', e);
    return false;
  }
}

export function clearLocalMockStore() {
  try {
    localStorage.removeItem(LOCAL_STORE_KEY);
    try { localStorage.setItem(LOCAL_UPDATE_KEY, String(Date.now())); } catch (e) {}
    window.dispatchEvent(new CustomEvent('mock-report-updated', { detail: { cleared: true } }));
    return true;
  } catch (e) {
    return false;
  }
}
