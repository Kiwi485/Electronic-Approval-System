/**
 * drivers-api.mock.js
 * 提供簡單司機 (driver) 清單，後續可改接 Firestore users 集合。
 */
import { randomUUID } from './util-uuid.js';

let _drivers = [
  { id: 'u1', displayName: '王小明', role: 'driver', isActive: true },
  { id: 'u2', displayName: '李阿華', role: 'driver', isActive: true },
  { id: 'u3', displayName: '退休師傅', role: 'driver', isActive: false }
];

const delay = (ms=120) => new Promise(r=>setTimeout(r, ms));

export async function listActiveDrivers() {
  await delay();
  return _drivers.filter(d=>d.isActive).map(d => ({ ...d }));
}

export async function listAllDrivers() {
  await delay();
  return _drivers.map(d => ({ ...d }));
}

export async function createDriver(name) {
  await delay();
  const item = { id: randomUUID(), displayName: name.trim(), role: 'driver', isActive: true };
  _drivers.push(item);
  return { ...item };
}

export async function updateDriver(id, patch) {
  await delay();
  const idx = _drivers.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Driver not found: ' + id);
  _drivers[idx] = { ..._drivers[idx], ...patch };
  return { ..._drivers[idx] };
}

export function __resetDriverMock() {
  _drivers = [
    { id: 'u1', displayName: '王小明', role: 'driver', isActive: true },
    { id: 'u2', displayName: '李阿華', role: 'driver', isActive: true },
    { id: 'u3', displayName: '退休師傅', role: 'driver', isActive: false }
  ];
}

console.info('[MockAPI] drivers-api.mock.js initialized');
