// 全域功能旗標 (Feature Flags)
// 可依開發 / 測試 / 上線調整。後續若導入更正式的設定，可改由 Firestore Remote Config 或環境檔。
<<<<<<< HEAD
window.APP_FLAGS = {
  // 使用 mock 資料 (true) 或真實 Firestore (false)
  USE_MOCK_DATA: true,
  // 是否啟用多機具 UI 與 payload 寫入 machines[]
=======
// 初始旗標（預設以 Firestore 為使用情境）
const DEFAULT_FLAGS = {
  USE_MOCK_DATA: false,
>>>>>>> 79bb55ed8ca216558de2adabbc926ca09dc9b7bf
  ENABLE_MULTI_MACHINE: true,
  ENABLE_MULTI_DRIVER: true,
<<<<<<< HEAD
  // 是否在簽單建立頁面過濾掉停用 (isActive=false) 的機具
  ENABLE_MACHINE_DEACTIVATE_FILTER: true,
  // （預留）是否顯示資料遷移工具按鈕
=======
  ENABLE_MACHINE_DEACTIVATE_FILTER: false,
>>>>>>> 79bb55ed8ca216558de2adabbc926ca09dc9b7bf
  ENABLE_MIGRATION_TOOL: true
};

// 支援可選的 localStorage persistence（鍵名）
const PERSIST_KEY = 'APP_FLAGS_USE_MOCK_DATA_PERSIST';

// 先讀取任何持久化設定（若使用者先前選擇 persist）
let persisted = null;
try { persisted = localStorage.getItem(PERSIST_KEY); } catch (e) { persisted = null; }
const initialFlags = { ...DEFAULT_FLAGS };
if (persisted === 'true') initialFlags.USE_MOCK_DATA = true;
if (persisted === 'false') initialFlags.USE_MOCK_DATA = false;

// 建立 proxy，監聽變更並廣播事件
const handler = {
  set(target, prop, value) {
    const old = target[prop];
    target[prop] = value;
    try {
      // 當 USE_MOCK_DATA 變更時，發出 appflagschange 事件
      if (prop === 'USE_MOCK_DATA' && old !== value) {
        console.info('[Flags] USE_MOCK_DATA changed =>', value);
        window.dispatchEvent(new CustomEvent('appflagschange', { detail: { key: 'USE_MOCK_DATA', value } }));
        // 自動持久化變更，讓 Console 切換在重新整理後維持
        try { localStorage.setItem(PERSIST_KEY, value ? 'true' : 'false'); console.info('[Flags] auto-persisted USE_MOCK_DATA =', value); } catch (e) { console.warn('[Flags] auto-persist failed', e); }
      }
    } catch (e) { /* ignore */ }
    return true;
  }
};

window.APP_FLAGS = new Proxy(initialFlags, handler);

// Helper: persist current USE_MOCK_DATA to localStorage
window.setUseMockPersist = function(v = true) {
  try {
    localStorage.setItem(PERSIST_KEY, v ? 'true' : 'false');
    console.info('[Flags] Persisted USE_MOCK_DATA =', v);
  } catch (e) { console.warn('[Flags] persist failed', e); }
};

window.clearUseMockPersist = function() {
  try { localStorage.removeItem(PERSIST_KEY); console.info('[Flags] Cleared persisted USE_MOCK_DATA'); } catch (e) { console.warn('[Flags] clear persist failed', e); }
};

console.info('[Flags] Loaded APP_FLAGS =', window.APP_FLAGS, ' (persistedOverride=', persisted, ')');
