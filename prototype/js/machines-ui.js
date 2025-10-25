// machines-ui.js - mirror drivers-ui behaviour: dynamic import mock/firestore impls and hide inactive machines

async function waitForFlags(timeout = 600) {
  const start = Date.now();
  while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, 30));
  }
  return window.APP_FLAGS;
}

async function initMachinesUi() {
  try {
    const elem = document.getElementById('machine');
    const datalistEl = document.getElementById('machineOptions');
    const isSelect = elem && elem.tagName && elem.tagName.toLowerCase() === 'select';
    if (!elem || (!datalistEl && !isSelect)) return;

    const flags = await waitForFlags(600);
    if (!flags) console.warn('[UI] config flags 未及時載入，將以預設值處理 (mock=true)');

    // 只顯示啟用中的機具（固定為 true，避免停用再次出現）
    const useFilter = true;

    // mirror drivers-ui：根據 flags 動態載入 mock 或 firestore 實作
    const wantMock = (window.APP_FLAGS?.USE_MOCK_DATA === true);
    const implModule = wantMock
      ? await import('./api/machines-api.mock.js?v=2025-10-23c')
      : await import('./api/machines-api.firestore.js?v=2025-10-23c');
    const fetcher = implModule.listActiveMachines;

    let machines = [];
    try {
      machines = await fetcher();
      if (!Array.isArray(machines)) machines = [];
    } catch (e) {
      console.warn('[UI] 載入機具清單失敗，改用空清單 fallback', e);
      machines = [];
    }

    const normalize = m => ({
      id: m?.id ?? '',
      name: m?.name ?? '',
      isActive: m?.isActive !== false
    });
    let cleaned = machines.map(normalize).filter(m => m.id && m.name);
    cleaned = cleaned.filter(m => m.isActive);

    if (isSelect) {
      const select = elem;
      const opts = cleaned.map(m => {
        const safeId = String(m.id).replace(/"/g, '&quot;');
        const safeName = (m.name || '').replace(/"/g, '&quot;');
        return `<option value="${safeId}" data-name="${safeName}" data-model="${safeName}">${safeName}</option>`;
      }).join('');
      select.innerHTML = `<option value="">— 選擇機具 —</option>` + opts;
      console.info(`[UI] 機具 select 載入完成 (active only)，共 ${cleaned.length} 筆，來源=${wantMock ? 'mock' : 'firestore'}`);
    } else {
      const visible = cleaned;
      datalistEl.innerHTML = visible.map(m => `<option value="${(m.name||'').replace(/\"/g,'&quot;')}"></option>`).join('');
      console.info(`[UI] 機具 datalist 載入完成 (active only)，共 ${visible.length} 筆，來源=${wantMock ? 'mock' : 'firestore'}`);
    }

    // optional debug overlay when ?debug=1
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('debug') === '1') {
        let dbg = document.getElementById('__ui_debug_info_machines');
        if (!dbg) {
          dbg = document.createElement('div');
          dbg.id = '__ui_debug_info_machines';
          dbg.style.position = 'fixed';
          dbg.style.right = '8px';
          dbg.style.bottom = '48px';
          dbg.style.background = 'rgba(0,0,0,0.75)';
          dbg.style.color = 'white';
          dbg.style.padding = '8px 10px';
          dbg.style.borderRadius = '6px';
          dbg.style.fontSize = '12px';
          dbg.style.zIndex = 99999;
          document.body.appendChild(dbg);
        }
        dbg.textContent = `[UI] 機具 loaded ${machines.length} (${isSelect ? 'select' : 'datalist'})`;
      }
    } catch (e) { /* ignore */ }

  } catch (err) {
    console.warn('[UI] 載入機具選單失敗', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMachinesUi);
} else {
  initMachinesUi();
}

// Listen for cross-tab updates: storage event (other tab) and custom event (same tab)
let _reloadTimer = null;
function scheduleReloadMachines() {
  if (_reloadTimer) clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(() => {
    try { initMachinesUi(); } catch (e) { console.warn('[UI] reload machines failed', e); }
  }, 150);
}

window.addEventListener('storage', (e) => {
  if (!e?.key) return;
  if (e.key === 'machines_updated_at') {
    scheduleReloadMachines();
  }
});

window.addEventListener('machines-updated', () => {
  scheduleReloadMachines();
});