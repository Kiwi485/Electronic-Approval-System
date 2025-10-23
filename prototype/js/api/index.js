// api/index.js
// 依據 APP_FLAGS 切換 Mock vs Firestore 實作
import * as machinesMock from './machines-api.mock.js';
import * as machinesFirestore from './machines-api.firestore.js';
import * as driversMock from './drivers-api.mock.js';
import * as driversFirestore from './drivers-api.firestore.js';

async function waitForFlags(timeout = 1000) {
	const start = Date.now();
	while (typeof window.APP_FLAGS === 'undefined' && (Date.now() - start) < timeout) {
		await new Promise(r => setTimeout(r, 30));
	}
	return window.APP_FLAGS;
}

// 動態判斷而不是載入時鎖死；支援 Runtime Override（Console 可即時改變）
function runtimeOverride() {
	const src = window.APP_RUNTIME?.FORCE_API_SOURCE;
	if (src === 'mock') return true;
	if (src === 'firestore') return false;
	return null; // 無覆寫
}

function useMock() {
	const o = runtimeOverride();
	if (o !== null) return o; // 以 Console 覆寫優先
	return (window.APP_FLAGS?.USE_MOCK_DATA) === true;
}
function m() { return useMock() ? machinesMock : machinesFirestore; }
function d() { return useMock() ? driversMock : driversFirestore; }

export function getApiSource() { return useMock() ? 'mock' : 'firestore'; }
export const API_SOURCE = getApiSource(); // 向後相容（初次載入顯示）

// 機具 API（函式轉發，每次呼叫都會重新判斷來源） -------------------------
export const listActiveMachines = (...a) => m().listActiveMachines(...a);
export const listAllMachines     = (...a) => m().listAllMachines(...a);
export const createMachine       = (...a) => m().createMachine(...a);
export const updateMachine       = (...a) => m().updateMachine(...a);
export const listCategories      = (...a) => m().listCategories(...a);
export const createCategory      = (...a) => m().createCategory(...a);
export const updateCategory      = (...a) => m().updateCategory(...a);

// 司機 API ---------------------------------------------------------------
export const listActiveDrivers = (...a) => d().listActiveDrivers(...a);
export const listAllDrivers    = (...a) => d().listAllDrivers(...a);
export const createDriver      = (...a) => d().createDriver(...a);
export const updateDriver      = (...a) => d().updateDriver(...a);

// 暴露整體模組（提供測試 / mock 重置等工具）；使用 getter 取得來源資訊
export const machines = { get __source() { return getApiSource(); }, ...machinesMock, ...machinesFirestore };
export const drivers  = { get __source() { return getApiSource(); }, ...driversMock, ...driversFirestore };

// 為避免 flags 尚未就緒時印出誤導訊息，延後到 flags 載入後再顯示一次來源
(async () => {
	await waitForFlags(1000);
	console.info(`[API] 目前資料來源 = ${getApiSource()} (依 config-flags.js)`);
})();
