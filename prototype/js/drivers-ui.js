import * as api from './api/index.js?v=20251022';

async function waitForFlags(timeout = 500) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 30));
  }
  return window.APP_FLAGS;
}

async function initDriversUi() {
  try {
    const selectEl = document.getElementById('driverName');
    if (!selectEl) return;

    const flags = await waitForFlags(600);
    if (!flags) console.warn('[UI] config flags 未及時載入，將以預設值處理 (mock=true)');

    // 預設「只顯示啟用中的司機」。若旗標存在則遵照旗標。
    const flag = window.APP_FLAGS?.ENABLE_DRIVER_DEACTIVATE_FILTER;
    const useFilter = (typeof flag === 'boolean') ? !!flag : true;

    // 使用統一 API，來源由 api/index.js 依 flags/override 動態決定
    const fetcher = useFilter ? api.listActiveDrivers : api.listAllDrivers;

    let drivers = [];
    try {
      drivers = await fetcher();
    } catch (e) {
      console.warn('[UI] 載入司機清單失敗，改用本地 fallback', e);
      drivers = [
        { displayName: '王小明' },
        { displayName: '李小華' },
        { displayName: '陳大同' }
      ];
    }

    const toName = (d) => d?.displayName || d?.name || '';
    const options = [
      '<option value="">— 選擇司機 —</option>',
      ...drivers
        .map(d => toName(d))
        .filter(Boolean)
        .map(n => `<option value="${n}">${n}</option>`)
    ].join('');
    selectEl.innerHTML = options;

    const src = api.getApiSource();
    const msg = `[UI] 司機下拉載入完成 (${useFilter ? 'active only' : 'all'})，共 ${drivers.length} 筆，來源=${src} | flags.mock=${window.APP_FLAGS?.USE_MOCK_DATA} | from=${import.meta.url}`;
    console.info(msg);

    // 如果 URL 帶 ?debug=1，顯示到頁面上方便使用者在沒有開發者工具時確認
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('debug') === '1') {
        let dbg = document.getElementById('__ui_debug_info');
        if (!dbg) {
          dbg = document.createElement('div');
          dbg.id = '__ui_debug_info';
          dbg.style.position = 'fixed';
          dbg.style.right = '8px';
          dbg.style.bottom = '8px';
          dbg.style.background = 'rgba(0,0,0,0.75)';
          dbg.style.color = 'white';
          dbg.style.padding = '8px 10px';
          dbg.style.borderRadius = '6px';
          dbg.style.fontSize = '12px';
          dbg.style.zIndex = 99999;
          document.body.appendChild(dbg);
        }
        dbg.textContent = msg;
      }
    } catch (e) {
      // ignore URL parsing errors
    }
  } catch (err) {
    console.warn('[UI] 司機下拉初始化失敗', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDriversUi);
} else {
  initDriversUi();
}

// 支援 Console/Override 變更時自動刷新
window.addEventListener('appflagschange', (e) => {
  const k = e?.detail?.key;
  if (k === 'ENABLE_DRIVER_DEACTIVATE_FILTER') {
    initDriversUi();
  }
});
// 不在 apisourcechange 即時刷新，改由重整或手動呼叫 refreshDriversUI()
