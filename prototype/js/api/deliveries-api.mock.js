// deliveries-api.mock.js
// Mock 實作：以 localStorage 模擬 deliveryNotes 的新增與查詢
import { randomUUID } from './util-uuid.js';

const LS_KEY = 'mock_delivery_notes';

function readAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function writeAll(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
}

export async function createDelivery(input) {
  const nowIso = new Date().toISOString();
  const id = 'mock_' + randomUUID();
  const item = {
    id,
    ...input,
    offline: false,
    createdAt: nowIso,
    serverCreatedAt: nowIso,
    signatureStatus: input.signatureStatus || 'pending'
  };
  const list = readAll();
  list.unshift(item);
  writeAll(list);
  return id;
}

export async function listHistoryDeliveries(limit = 100) {
  const list = readAll();
  const sorted = list.slice().sort((a,b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
  return sorted.slice(0, limit);
}

export async function listPendingDeliveries(limit = 100) {
  const list = readAll().filter(x => (x.signatureStatus || 'pending') === 'pending');
  const sorted = list.slice().sort((a,b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
  return sorted.slice(0, limit);
}

console.info('[MockAPI] deliveries-api.mock.js initialized');
