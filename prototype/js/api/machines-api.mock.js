/**
 * machines-api.mock.js
 * In-memory mock 實作。提供極簡 async 模擬，方便前端平行開發。
 */

import { randomUUID } from './util-uuid.js';

// 初始類別資料
let _categories = [
  { id: 'excavator', name: '挖土機', isActive: true, order: 10 },
  { id: 'crane', name: '吊車', isActive: true, order: 20 },
  { id: 'old-machine', name: '舊機具(停用示例)', isActive: false, order: 99 }
];

// 初始機具資料
let _machines = [
  { id: 'm1', name: 'PC200 挖土機', categoryId: 'excavator', isActive: true, usageCount: 0, lastUsedAt: null },
  { id: 'm2', name: '住友吊車 S1', categoryId: 'crane', isActive: true, usageCount: 3, lastUsedAt: null },
  { id: 'm3', name: '報廢示例機', categoryId: 'old-machine', isActive: false, usageCount: 10, lastUsedAt: null }
];

const delay = (ms=140) => new Promise(r => setTimeout(r, ms));

export async function listActiveMachines() {
  await delay();
  return _machines.filter(m => m.isActive).map(m => ({ ...m }));
}

export async function listAllMachines() {
  await delay();
  return _machines.map(m => ({ ...m }));
}

export async function createMachine(input) {
  await delay();
  const item = {
    id: randomUUID(),
    name: input.name.trim(),
    categoryId: input.categoryId || null,
    isActive: true,
    usageCount: 0,
    lastUsedAt: null
  };
  _machines.push(item);
  return { ...item };
}

export async function updateMachine(id, patch) {
  await delay();
  const idx = _machines.findIndex(m => m.id === id);
  if (idx === -1) throw new Error('Machine not found: ' + id);
  _machines[idx] = { ... _machines[idx], ...patch };
  return { ..._machines[idx] };
}

// 類別 ----------------------------------------------------------
export async function listCategories() {
  await delay();
  return _categories.slice().sort((a,b)=> (a.order||0) - (b.order||0)).map(c => ({ ...c }));
}

export async function createCategory(input) {
  await delay();
  const slug = (input.slug || input.name).trim().toLowerCase().replace(/\s+/g,'-');
  if (_categories.some(c => c.id === slug)) throw new Error('Category already exists: ' + slug);
  const item = { id: slug, name: input.name.trim(), isActive: true, order: input.order ?? 50 };
  _categories.push(item);
  return { ...item };
}

export async function updateCategory(id, patch) {
  await delay();
  const idx = _categories.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Category not found: ' + id);
  _categories[idx] = { ..._categories[idx], ...patch };
  return { ..._categories[idx] };
}

// 提供重置（測試用）
export function __resetMockData() {
  _categories = [
    { id: 'excavator', name: '挖土機', isActive: true, order: 10 },
    { id: 'crane', name: '吊車', isActive: true, order: 20 },
    { id: 'old-machine', name: '舊機具(停用示例)', isActive: false, order: 99 }
  ];
  _machines = [
    { id: 'm1', name: 'PC200 挖土機', categoryId: 'excavator', isActive: true, usageCount: 0, lastUsedAt: null },
    { id: 'm2', name: '住友吊車 S1', categoryId: 'crane', isActive: true, usageCount: 3, lastUsedAt: null },
    { id: 'm3', name: '報廢示例機', categoryId: 'old-machine', isActive: false, usageCount: 10, lastUsedAt: null }
  ];
}

console.info('[MockAPI] machines-api.mock.js initialized');
