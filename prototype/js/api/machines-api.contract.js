/**
 * machines-api.contract.js
 * 契約檔：定義『機具 / 類別』相關 API 介面。任何實作（mock / firestore）都必須提供同名函式。
 * 後續接 Firestore 時僅需新增一個 machines-api.firestore.js 並在 index.js 切換。
 *
 * Machine 物件最小欄位：
 * {
 *   id: string,
 *   name: string,
 *   categoryId: string|null,
 *   vehicleNumber: string|null,
 *   isActive: boolean,
 *   usageCount: number,
 *   lastUsedAt: string|null  // ISO 字串或 null
 * }
 *
 * MachineCategory 物件：
 * {
 *   id: string,       // = slug
 *   name: string,
 *   isActive: boolean,
 *   order: number
 * }
 */

export async function listActiveMachines() {
  throw new Error('machines-api.contract: listActiveMachines not implemented');
}

export async function listAllMachines() {
  throw new Error('machines-api.contract: listAllMachines not implemented');
}

/**
 * @param {{name:string, categoryId:string|null, vehicleNumber?:string|null}} input
 */
export async function createMachine(input) {
  throw new Error('machines-api.contract: createMachine not implemented');
}

/**
 * @param {string} id
 * @param {{name?:string, categoryId?:string|null, vehicleNumber?:string|null, isActive?:boolean}} patch
 */
export async function updateMachine(id, patch) {
  throw new Error('machines-api.contract: updateMachine not implemented');
}

// 類別相關 ------------------------------------------------------
export async function listCategories() {
  throw new Error('machines-api.contract: listCategories not implemented');
}

/**
 * @param {{id?:string, name:string, slug?:string, order?:number}} input
 */
export async function createCategory(input) {
  throw new Error('machines-api.contract: createCategory not implemented');
}

/**
 * @param {string} id
 * @param {{name?:string, isActive?:boolean, order?:number}} patch
 */
export async function updateCategory(id, patch) {
  throw new Error('machines-api.contract: updateCategory not implemented');
}
