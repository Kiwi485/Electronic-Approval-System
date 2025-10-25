// deliveries-api.mock.js
// Mock 實作：以 localStorage 模擬 deliveryNotes 的新增與查詢
import { randomUUID } from './util-uuid.js';
import { getUserContext } from '../session-context.js';

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
  const assignedTo = Array.isArray(input?.assignedTo) ? [...new Set(input.assignedTo.filter(Boolean))] : [];
  const readableBase = Array.isArray(input?.readableBy) ? input.readableBy.filter(Boolean) : [];
  const readableSet = new Set(readableBase);
  if (input?.createdBy) readableSet.add(input.createdBy);
  assignedTo.forEach(v => readableSet.add(v));
  const item = {
    id,
    ...input,
    offline: false,
    createdAt: nowIso,
    serverCreatedAt: nowIso,
    signatureStatus: input.signatureStatus || 'pending',
    assignedTo,
    readableBy: Array.from(readableSet)
  };
  const list = readAll();
  list.unshift(item);
  writeAll(list);
  return id;
}

export async function listHistoryDeliveries(limit = 100) {
  const { uid, role } = await getUserContext();
  const list = readAll();
  const filtered = (role === 'manager' || !uid)
    ? list
    : list.filter(item => {
        const assigned = Array.isArray(item.assignedTo) && item.assignedTo.includes(uid);
        const readable = Array.isArray(item.readableBy) && item.readableBy.includes(uid);
        const creator = item.createdBy === uid;
        return assigned || readable || creator;
      });
  const sorted = filtered.slice().sort((a,b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
  return sorted.slice(0, limit);
}

export async function listPendingDeliveries(limit = 100) {
  const history = await listHistoryDeliveries(limit * 2);
  return history.filter(x => (x.signatureStatus || 'pending') === 'pending').slice(0, limit);
}

console.info('[MockAPI] deliveries-api.mock.js initialized');
