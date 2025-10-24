// dev-seed.js
// 一次性建立測試資料（Categories / Machines / Drivers）到 Firestore Emulator 或正式專案。
// 使用方式 (在任何已載入 firebase-init.js 且已登入的頁面 Console):
// import('./js/dev-seed.js').then(m => m.seedAll())
// 可重複執行；若文件已存在則跳過。若要強制覆蓋可使用 seedAll({ force: true })

import { db } from '../firebase-init.js'; // ← 修正路徑（原本錯誤：./firebase-init.js）
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  setDoc
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

// 載入時記錄（方便確認是否為最新模組）
console.info('[Seed module loaded]', new Date().toISOString());

// ---- 可調整資料 --------------------------------------------------
const seedCategories = [
  { id: 'excavator', name: '挖土機', isActive: true, order: 10 },
  { id: 'crane', name: '吊車', isActive: true, order: 20 },
  { id: 'old-machine', name: '舊機具示範', isActive: false, order: 90 }
];

const seedMachines = [
  { id: 'm-pc200', name: 'PC200 挖土機', categoryId: 'excavator', isActive: true },
  { id: 'm-sumito', name: '住友吊車 S1', categoryId: 'crane', isActive: true },
  { id: 'm-retire', name: '報廢示範機', categoryId: 'old-machine', isActive: false }
];

const seedDrivers = [
  { id: 'u-wang', displayName: '王小明', email: 'wang@example.test', role: 'driver', isActive: true },
  { id: 'u-lee', displayName: '李阿華', email: 'lee@example.test', role: 'driver', isActive: true },
  { id: 'u-retire', displayName: '退休師傅', email: 'retire@example.test', role: 'driver', isActive: false }
];

// 單一 manager（用來測試不同 email 登入會看到不同功能）
const seedManagers = [
  { id: 'u-manager', displayName: '系統經理', email: 'manager@example.test', role: 'manager', isActive: true }
];
// -----------------------------------------------------------------

async function ensureDoc(path, data, batch, force=false) {
  const ref = doc(db, path);
  if (!force) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      console.info('[Seed] skip (exists)', path, 'id=', ref.id);
      return false;
    }
  }
  const now = serverTimestamp();
  // 確保 users 文件包含 uid 欄位（使用傳入的 uid 或 doc id）
  const docId = ref.id;
  console.info('[Seed] queue set', path, 'uid=', data.uid || data.id || docId);
  batch.set(ref, {
    ...data,
    uid: data.uid || data.id || docId,
    createdAt: now,
    updatedAt: now,
    usageCount: data.usageCount ?? 0,
    lastUsedAt: data.lastUsedAt ?? null
  });
  return true;
}

/**
 * 參數:
 *  options.force = true  -> 已存在也覆蓋 (updatedAt/createdAt 會重置)
 */
export async function seedAll(options = {}) {
  const { force = false } = options;
  console.info('[Seed] seedAll start', { force, seedData: getSeedData() });
  const batch = writeBatch(db);
  let created = { categories: 0, machines: 0, drivers: 0, managers: 0, force };

  for (const c of seedCategories) {
    if (await ensureDoc(`machineCategories/${c.id}`, c, batch, force)) created.categories++;
  }
  for (const m of seedMachines) {
    if (await ensureDoc(`machines/${m.id}`, m, batch, force)) created.machines++;
  }
  // managers（先寫 managers）
  for (const mg of (seedManagers || [])) {
    if (await ensureDoc(`users/${mg.id}`, mg, batch, force)) created.managers++;
  }
  for (const d of seedDrivers) {
    if (await ensureDoc(`users/${d.id}`, d, batch, force)) created.drivers++;
  }

  await batch.commit();
  console.info('[Seed] 完成：', created);
  return created;
}

export function getSeedData() {
  return { seedCategories, seedMachines, seedDrivers, seedManagers };
}

// 如果想快速在 Console 一鍵呼叫，可取消下行註解：
// seedAll();

console.info('[Seed] dev-seed.js 已載入 → import("./js/dev-seed.js").then(m=>m.seedAll())');