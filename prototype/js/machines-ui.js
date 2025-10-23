import * as api from './api/index.js';

(async () => {
  try {
    const elem = document.getElementById('machine');
    const datalistEl = document.getElementById('machineOptions');
    const isSelect = elem && elem.tagName && elem.tagName.toLowerCase() === 'select';
    // 如果既沒有 datalist 也不是 select，就不處理
    if (!elem || (!datalistEl && !isSelect)) return;

    // 開關：true → 只顯示啟用機具；false → 顯示全部
    const useFilter = !!window.APP_FLAGS?.ENABLE_MACHINE_DEACTIVATE_FILTER;
    const fetcher = useFilter ? api.listActiveMachines : api.listAllMachines;
    // If a mock origin is desired, require explicit true to avoid accidental mock when flags not loaded
    const wantMock = (window.APP_FLAGS?.USE_MOCK_DATA === true);

    const machines = await fetcher();

    if (isSelect) {
      // elem is a <select>
      const select = elem;
      // 保留第一個空白選項
      select.innerHTML = `<option value="">— 選擇機具 —</option>` + machines.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
      console.info(`[UI] 機具 select 載入完成 (${useFilter ? 'active only' : 'all'})，共 ${machines.length} 筆，來源=${api.getApiSource()}`);
    } else {
      // fallback: populate datalist
      datalistEl.innerHTML = machines.map(m => `<option value="${m.name}"></option>`).join('');
      console.info(`[UI] 機具 datalist 載入完成 (${useFilter ? 'active only' : 'all'})，共 ${machines.length} 筆，來源=${api.getApiSource()}`);
    }
  } catch (err) {
    console.warn('[UI] 載入機具選單失敗', err);
  }
})();