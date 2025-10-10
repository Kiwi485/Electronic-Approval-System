// 全域功能旗標 (Feature Flags)
// 可依開發 / 測試 / 上線調整。後續若導入更正式的設定，可改由 Firestore Remote Config 或環境檔。
window.APP_FLAGS = {
  // 使用 mock 資料 (true) 或真實 Firestore (false)
  USE_MOCK_DATA: true,
  // 是否啟用多機具 UI 與 payload 寫入 machines[]
  ENABLE_MULTI_MACHINE: true,
  // 是否啟用多司機 UI 與 payload 寫入 drivers[]
  ENABLE_MULTI_DRIVER: true,
  // 是否在簽單建立頁面過濾掉停用 (isActive=false) 的機具
  ENABLE_MACHINE_DEACTIVATE_FILTER: true,
  // （預留）是否顯示資料遷移工具按鈕
  ENABLE_MIGRATION_TOOL: true
};

console.info('[Flags] Loaded APP_FLAGS =', window.APP_FLAGS);
