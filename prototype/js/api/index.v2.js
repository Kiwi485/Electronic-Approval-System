// api/index.v2.js
// 新版本 - 支援 deleteMachine 功能
// 依據 APP_FLAGS 切換 Mock vs Firestore 實作
import * as machinesMock from './machines-api.mock.v2.js';
import * as machinesFirestore from './machines-api.firestore.v2.js';
import * as driversMock from './drivers-api.mock.js';
import * as driversFirestore from './drivers-api.firestore.js';

// 動態判斷而不是載入時鎖死，避免 config-flags.js 尚未載入造成永遠使用 mock
function useMock() {
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
export const deleteMachine       = (...a) => m().deleteMachine(...a); // 🆕 新增
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

console.info(`[API] 目前資料來源 = ${getApiSource()} (動態判斷) - v2 with deleteMachine`);
