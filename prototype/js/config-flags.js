// 全域功能旗標 (Feature Flags)
// 可依開發 / 測試 / 上線調整。後續若導入更正式的設定，可改由 Firestore Remote Config 或環境檔。
window.APP_FLAGS = {
  // 使用 mock 資料 (true) 或真實 Firestore (false)
  USE_MOCK_DATA: false,
  // 是否啟用多機具 UI 與 payload 寫入 machines[]
  ENABLE_MULTI_MACHINE: true,
  // 是否啟用多司機 UI 與 payload 寫入 drivers[]
  ENABLE_MULTI_DRIVER: true,
  // 是否在簽單建立頁面過濾掉停用 (isActive=false) 的機具
  ENABLE_MACHINE_DEACTIVATE_FILTER: false,
  // 是否在簽單建立頁面過濾掉停用 (isActive=false) 的司機
  // 若未設定，drivers-ui 會預設為 true（僅啟用）；現在明確寫入以避免混淆
  ENABLE_DRIVER_DEACTIVATE_FILTER: true,
  // （預留）是否顯示資料遷移工具按鈕
  ENABLE_MIGRATION_TOOL: true
};

console.info('[Flags] Loaded APP_FLAGS =', window.APP_FLAGS);

// ---- Runtime override：Console 可獨立於 APP_FLAGS 控制來源（支援跨刷新持久化） ----
const __LS_KEY = 'app.runtime.forceApiSource';
let __persisted = null;
try { __persisted = localStorage.getItem(__LS_KEY); } catch {}
if (__persisted !== 'mock' && __persisted !== 'firestore') __persisted = null;
window.APP_RUNTIME = window.APP_RUNTIME || { FORCE_API_SOURCE: __persisted }; // 'mock' | 'firestore' | null

function emit(type, detail) {
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}

// Console helpers
window.setApiSource = function setApiSource(src /* 'mock' | 'firestore' | null */) {
  if (src !== 'mock' && src !== 'firestore' && src !== null) {
    console.warn('[Flags] setApiSource: 無效值，使用 null 取消覆寫');
    src = null;
  }
  window.APP_RUNTIME.FORCE_API_SOURCE = src;
  try {
    if (src === null) {
      localStorage.removeItem(__LS_KEY);
    } else {
      localStorage.setItem(__LS_KEY, src);
    }
  } catch {}
  console.info('[Flags] RUNTIME API SOURCE =>', src ?? '(follow config)');
  emit('apisourcechange', { source: src });
};

window.useMock = () => window.setApiSource('mock');
window.useFirestore = () => window.setApiSource('firestore');
window.useConfigSource = () => window.setApiSource(null);

// ---- Dev helpers：允許在 Console 即時切換並同步 UI ----
function dispatchFlagsChange(key) {
  try {
    window.dispatchEvent(new CustomEvent('appflagschange', {
      detail: { key, value: window.APP_FLAGS?.[key] }
    }));
  } catch {}
}

window.setUseMockData = function setUseMockData(v) {
  window.APP_FLAGS.USE_MOCK_DATA = v === true;
  console.info('[Flags] USE_MOCK_DATA =>', window.APP_FLAGS.USE_MOCK_DATA);
  dispatchFlagsChange('USE_MOCK_DATA');
  // 讓以 APP_FLAGS 設值也能直接影響實際來源（同你在 Console 的預期用法）
  if (window.setApiSource) {
    window.setApiSource(window.APP_FLAGS.USE_MOCK_DATA ? 'mock' : 'firestore');
  }
};

window.toggleMock = function toggleMock() {
  window.setUseMockData(!window.APP_FLAGS?.USE_MOCK_DATA);
};

window.setDriverFilterEnabled = function setDriverFilterEnabled(v) {
  window.APP_FLAGS.ENABLE_DRIVER_DEACTIVATE_FILTER = v === true;
  console.info('[Flags] ENABLE_DRIVER_DEACTIVATE_FILTER =>', window.APP_FLAGS.ENABLE_DRIVER_DEACTIVATE_FILTER);
  dispatchFlagsChange('ENABLE_DRIVER_DEACTIVATE_FILTER');
};

window.setMachineFilterEnabled = function setMachineFilterEnabled(v) {
  window.APP_FLAGS.ENABLE_MACHINE_DEACTIVATE_FILTER = v === true;
  console.info('[Flags] ENABLE_MACHINE_DEACTIVATE_FILTER =>', window.APP_FLAGS.ENABLE_MACHINE_DEACTIVATE_FILTER);
  dispatchFlagsChange('ENABLE_MACHINE_DEACTIVATE_FILTER');
};

// ---- 讓直接指定 window.APP_FLAGS.<key> = value 也會觸發事件 ----
(() => {
  const flags = window.APP_FLAGS;
  const notify = (key, val) => {
    try {
      window.dispatchEvent(new CustomEvent('appflagschange', { detail: { key, value: val } }));
    } catch {}
  };
  ['USE_MOCK_DATA', 'ENABLE_DRIVER_DEACTIVATE_FILTER', 'ENABLE_MACHINE_DEACTIVATE_FILTER'].forEach((key) => {
    let _val = flags[key];
    try {
      Object.defineProperty(flags, key, {
        get() { return _val; },
        set(v) {
          _val = v;
          notify(key, _val);
          if (key === 'USE_MOCK_DATA' && window.setApiSource) {
            // 讓直接寫 APP_FLAGS.USE_MOCK_DATA 也能切換來源
            window.setApiSource(_val ? 'mock' : 'firestore');
          }
        },
        configurable: true,
        enumerable: true
      });
    } catch {
      // 某些環境若 defineProperty 失敗則略過，仍可使用 setUseMockData 等 helper
    }
  });
})();
