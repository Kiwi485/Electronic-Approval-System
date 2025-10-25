/**
 * drivers-api.mock.js
 * 提供簡單司機 (driver) Mock API，含 list/create/update/delete。
 *
 * createDriver(input) 接受：
 *  - string (displayName) 或
 *  - object { displayName, isActive, email, phone, licenseNo }
 *
 * 預設行為：
 *  - 若未明確傳入 isActive === true，則預設為 false（即「不啟用」）
 */
import { randomUUID } from './util-uuid.js';

let _drivers = [
  {
    id: 'u1',
    displayName: '王小明',
    role: 'driver',
    isActive: true,
    email: 'wang@example.com',
    phone: '0912-000001',
    licenseNo: 'D-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u2',
    displayName: '李阿華',
    role: 'driver',
    isActive: true,
    email: 'li@example.com',
    phone: '0912-000002',
    licenseNo: 'D-002',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u3',
    displayName: '退休師傅',
    role: 'driver',
    isActive: false,
    email: null,
    phone: null,
    licenseNo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// managers mock data
let _managers = [
  {
    id: 'u-manager',
    displayName: '系統經理',
    role: 'manager',
    isActive: true,
    email: 'manager@example.com',
    phone: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));

export async function listActiveDrivers() {
  await delay();
  return _drivers.filter((d) => d.isActive).map((d) => ({ ...d }));
}

export async function listAllDrivers() {
  await delay();
  return _drivers.map((d) => ({ ...d }));
}

export async function listActiveManagers() {
  await delay();
  return _managers.filter(m => m.isActive).map(m => ({ ...m }));
}

export async function listAllManagers() {
  await delay();
  return _managers.map(m => ({ ...m }));
}

/**
 * createDriver(input)
 * input 可以是 string (displayName) 或 object
 * 預設 isActive 為 false（除非 input.isActive === true）
 */
export async function createDriver(input) {
  await delay();
  let payload = {};
  if (typeof input === 'string') {
    payload.displayName = input.trim();
  } else if (typeof input === 'object' && input !== null) {
    payload.displayName = (input.displayName || '').toString().trim();
    payload.isActive = input.isActive === true;
    payload.email = input.email ?? null;
    payload.phone = input.phone ?? null;
    payload.licenseNo = input.licenseNo ?? null;
  } else {
    throw new Error('createDriver: invalid input');
  }

  if (!payload.displayName) {
    throw new Error('Driver displayName is required');
  }

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    displayName: payload.displayName,
    role: 'driver',
    isActive: payload.isActive === true ? true : false, // default false
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    licenseNo: payload.licenseNo ?? null,
    createdAt: now,
    updatedAt: now
  };

  _drivers.push(item);
  return { ...item };
}

export async function updateDriver(id, patch) {
  await delay();
  const idx = _drivers.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Driver not found: ' + id);

  const current = _drivers[idx];
  const updates = { ...current };

  if (patch?.displayName !== undefined) updates.displayName = (patch.displayName || '').toString().trim();
  if (patch?.isActive !== undefined) updates.isActive = !!patch.isActive;
  if (patch?.email !== undefined) updates.email = patch.email ?? null;
  if (patch?.phone !== undefined) updates.phone = patch.phone ?? null;
  if (patch?.licenseNo !== undefined) updates.licenseNo = patch.licenseNo ?? null;

  updates.updatedAt = new Date().toISOString();

  _drivers[idx] = updates;
  return { ...updates };
}

export async function deleteDriver(id) {
  await delay();
  const idx = _drivers.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Driver not found: ' + id);
  _drivers.splice(idx, 1);
  return true;
}

export function __resetDriverMock() {
  _drivers = [
    {
      id: 'u1',
      displayName: '王小明',
      role: 'driver',
      isActive: true,
      email: 'wang@example.com',
      phone: '0912-000001',
      licenseNo: 'D-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'u2',
      displayName: '李阿華',
      role: 'driver',
      isActive: true,
      email: 'li@example.com',
      phone: '0912-000002',
      licenseNo: 'D-002',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'u3',
      displayName: '退休師傅',
      role: 'driver',
      isActive: false,
      email: null,
      phone: null,
      licenseNo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

console.info('[MockAPI] drivers-api.mock.js initialized');