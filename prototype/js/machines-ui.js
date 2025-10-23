import * as api from './api/index.js?v=20251022';

async function waitForFlags(timeout = 500) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 30));
  }
  return window.APP_FLAGS;
}

(async () => {
  try {
    const selectEl = document.getElementById('machine');
    if (!selectEl) return;
    await waitForFlags(600);
    // 開關：true → 只顯示啟用機具；false → 顯示全部
    const useFilter = !!window.APP_FLAGS?.ENABLE_MACHINE_DEACTIVATE_FILTER;
    const fetcher = useFilter ? api.listActiveMachines : api.listAllMachines;

    const machines = await fetcher();
    const options = [
      '<option value="">— 選擇機具 —</option>',
      ...machines.map(m => `<option value="${m.name}">${m.name}</option>`)
    ].join('');
    selectEl.innerHTML = options;

    console.info(`[UI] 機具選單載入完成 (${useFilter ? 'active only' : 'all'})，共 ${machines.length} 筆，來源=${api.getApiSource()}`);
  } catch (err) {
    console.warn('[UI] 載入機具選單失敗', err);
  }
})();

// 旗標或來源覆寫變更時自動刷新
window.addEventListener('appflagschange', (e) => {
  const k = e?.detail?.key;
  if (k === 'ENABLE_MACHINE_DEACTIVATE_FILTER') {
    (async () => {
      try {
        const selectEl = document.getElementById('machine');
        if (!selectEl) return;
        await waitForFlags(600);
        const useFilter = !!window.APP_FLAGS?.ENABLE_MACHINE_DEACTIVATE_FILTER;
        const fetcher = useFilter ? api.listActiveMachines : api.listAllMachines;
        const machines = await fetcher();
        const options = ['<option value="">— 選擇機具 —</option>', ...machines.map(m => `<option value="${m.name}">${m.name}</option>`)].join('');
        selectEl.innerHTML = options;
        console.info(`[UI] 機具選單重新載入（filter 變更）`);
      } catch {}
    })();
  }
});