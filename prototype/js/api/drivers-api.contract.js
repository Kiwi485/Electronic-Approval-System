/**
 * drivers-api.contract.js
 * 契約檔：定義『司機 (Driver)』相關 API 介面。任何實作（mock / firestore）都必須提供同名函式。
 *
 * Driver 物件最小欄位：
 * {
 *   id: string,
 *   displayName: string,   // 顯示名稱
 *   role: string,          // 預期 'driver'
 *   isActive: boolean,
 *   email?: string|null,
 *   phone?: string|null,
 *   licenseNo?: string|null,
 *   createdAt?: string|null,
 *   updatedAt?: string|null
 * }
 */

export async function listActiveDrivers() {
  throw new Error('drivers-api.contract: listActiveDrivers not implemented');
}

export async function listAllDrivers() {
  throw new Error('drivers-api.contract: listAllDrivers not implemented');
}

/**
 * @param {{displayName:string, email?:string|null, phone?:string|null, licenseNo?:string|null}} input
 */
export async function createDriver(input) {
  throw new Error('drivers-api.contract: createDriver not implemented');
}

/**
 * @param {string} id
 * @param {{displayName?:string, isActive?:boolean, email?:string|null, phone?:string|null, licenseNo?:string|null}} patch
 */
export async function updateDriver(id, patch) {
  throw new Error('drivers-api.contract: updateDriver not implemented');
}
