// We'll dynamically import the appropriate implementation (mock vs firestore)

async function waitForFlags(timeout = 500) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 30));
  }
  return window.APP_FLAGS;
}

async function initDriversUi() {
  try {
    const elem = document.getElementById('driverName');
    const datalistEl = document.getElementById('driverOptions');
    const isSelect = elem && elem.tagName && elem.tagName.toLowerCase() === 'select';
    if (!elem || (!datalistEl && !isSelect)) return;

    const flags = await waitForFlags(600);
    if (!flags) console.warn('[UI] config flags 未及時載入，將以預設值處理 (mock=true)');

    // 預設「只顯示啟用中的司機」。若旗標存在則遵照旗標。
    const flag = window.APP_FLAGS?.ENABLE_DRIVER_DEACTIVATE_FILTER;
    const useFilter = (typeof flag === 'boolean') ? !!flag : true;

    // 動態 import：根據 flags 決定要載入 mock 或 firestore 實作
    // 注意：只有當 flags 明確為 true 時才使用 mock，避免 flags 未載入時誤判
    const wantMock = (window.APP_FLAGS?.USE_MOCK_DATA === true);
    const implModule = wantMock
      ? await import('./api/drivers-api.mock.js?v=2025-10-22a')
      : await import('./api/drivers-api.firestore.js?v=2025-10-22a');
    const fetcher = useFilter ? implModule.listActiveDrivers : implModule.listAllDrivers;

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

    const normalized = drivers
      .map((driver) => {
        const name = driver?.displayName || driver?.name || '';
        const docId = driver?.id || driver?.docId || '';
        const resolvedId = driver?.uid || driver?.userId || docId;
        const email = driver?.email || driver?.primaryEmail || '';
        if (!name) return null;
        return {
          id: resolvedId || null,
          name,
          displayName: name,
          email: email || null,
          docId: docId || null,
          raw: driver
        };
      })
      .filter(Boolean);

    window.__EAS_DRIVER_CATALOG = normalized;

    const names = normalized.map(d => d.name);

    if (isSelect) {
      const select = elem;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— 選擇司機 —';
      select.appendChild(placeholder);

      normalized.forEach((driver) => {
        const option = document.createElement('option');
        option.value = driver.name;
        option.textContent = driver.name;
        option.dataset.name = driver.name;
        if (driver.id) {
          option.dataset.id = driver.id;
          option.dataset.uid = driver.id;
        }
        if (driver.docId) option.dataset.docId = driver.docId;
        if (driver.email) option.dataset.email = driver.email;
        select.appendChild(option);
      });
      console.info(`[UI] 司機 select 載入完成 (${useFilter ? 'active only' : 'all'})，共 ${names.length} 筆，來源=${wantMock? 'mock':'firestore'}`);
    } else {
      datalistEl.innerHTML = '';
      normalized.forEach((driver) => {
        const option = document.createElement('option');
        option.value = driver.name;
        option.dataset.name = driver.name;
        if (driver.id) {
          option.dataset.id = driver.id;
          option.dataset.uid = driver.id;
        }
        if (driver.docId) option.dataset.docId = driver.docId;
        if (driver.email) option.dataset.email = driver.email;
        datalistEl.appendChild(option);
      });
      console.info(`[UI] 司機 datalist 載入完成 (${useFilter ? 'active only' : 'all'})，共 ${names.length} 筆，來源=${wantMock? 'mock':'firestore'}`);
    }

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
        dbg.textContent = `[UI] 司機 loaded ${names.length} (${isSelect ? 'select' : 'datalist'})`;
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
