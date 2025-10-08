// seed-drivers.js
// 司機資料種子腳本：避免團隊每個人手動輸入。僅在開發時使用。
// 使用方式：在 config-flags.js 將 ENABLE_MIGRATION_TOOL 設為 true 並於頁面引入此檔，Console 執行 seedDrivers()

import { db } from '../../firebase-init.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const DRIVERS = [
  { id: 'd-liming', displayName: '李明', role: 'driver', isActive: true,  email: 'li.ming@example.com', phone: '0912-000-111', licenseNo: 'A123456789' },
  { id: 'd-wang',   displayName: '王大華', role: 'driver', isActive: true,  email: 'wang@example.com',   phone: '0912-000-222', licenseNo: null },
  { id: 'd-retire', displayName: '退休司機', role: 'driver', isActive: false, email: null,                phone: null,            licenseNo: null }
];

export async function seedDrivers(force = false) {
  if (!window.APP_FLAGS?.ENABLE_MIGRATION_TOOL) {
    console.warn('[seed-drivers] 旗標 ENABLE_MIGRATION_TOOL 未啟用，已中止。');
    return { created: 0, skipped: DRIVERS.length };
  }
  let created = 0, skipped = 0;
  for (const d of DRIVERS) {
    const ref = doc(db, 'drivers', d.id);
    const snap = await getDoc(ref);
    if (snap.exists() && !force) {
      skipped++; console.log('[seed-drivers] skip', d.id); continue;
    }
    const ts = serverTimestamp();
    await setDoc(ref, { ...d, createdAt: ts, updatedAt: ts });
    created++; console.log('[seed-drivers] upsert', d.id);
  }
  const result = { created, skipped, total: DRIVERS.length };
  console.log('[seed-drivers] done', result);
  return result;
}

window.seedDrivers = seedDrivers;

if (window.APP_FLAGS?.ENABLE_MIGRATION_TOOL) {
  console.info('[seed-drivers] 可執行 seedDrivers() 產生司機測試資料');
}
