import * as api from './api/index.js';

(async () => {
  try {
    const input = document.getElementById('machine');
    const listEl = document.getElementById('machineOptions');
    if (!input || !listEl) return;

    // 開關：true → 只顯示啟用機具；false → 顯示全部
    const useFilter = !!window.APP_FLAGS?.ENABLE_MACHINE_DEACTIVATE_FILTER;
    const fetcher = useFilter ? api.listActiveMachines : api.listAllMachines;

    const machines = await fetcher();
    listEl.innerHTML = machines.map(m => `<option value="${m.name}">${m.name}</option>`).join('');

    console.info(`[UI] 機具選單載入完成 (${useFilter ? 'active only' : 'all'})，共 ${machines.length} 筆，來源=${api.getApiSource()}`);
  } catch (err) {
    console.warn('[UI] 載入機具選單失敗', err);
  }
})();