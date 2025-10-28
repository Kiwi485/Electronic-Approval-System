import { db } from '../firebase-init.js';
import { doc, getDoc, updateDoc, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { listAllMachines } from './api/index.v2.js';

export const MACHINE_USAGE_FLAG = 'machineUsageApplied';

const MACHINE_NAME_PLACEHOLDER_REGEX = /選擇機具|^[-—\s]*$/;
const MACHINE_CATALOG_TTL_MS = 60 * 1000;

let machineCatalogCache = null;
let machineCatalogFetchedAt = 0;

function resolveMachineIdCandidate(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = resolveMachineIdCandidate(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (MACHINE_NAME_PLACEHOLDER_REGEX.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'object') {
    const nested = [value.id, value.machineId, value.uid, value.code];
    for (const item of nested) {
      const candidate = resolveMachineIdCandidate(item);
      if (candidate) return candidate;
    }
  }
  return null;
}

export function getMachineIdFromNote(note = {}) {
  if (!note || typeof note !== 'object') return null;
  const directCandidates = [note.machineId, note.machineRefId, note.machineUid, note.machineCode];
  for (const value of directCandidates) {
    const id = resolveMachineIdCandidate(value);
    if (id) return id;
  }
  const objectCandidates = [note.machine, note.machineRef, note.machineInfo];
  for (const obj of objectCandidates) {
    if (!obj || typeof obj !== 'object') continue;
    const id = resolveMachineIdCandidate(obj);
    if (id) return id;
  }
  if (Array.isArray(note.machines)) {
    const id = resolveMachineIdCandidate(note.machines);
    if (id) return id;
  }
  return null;
}

function normalizeCompareText(text) {
  return typeof text === 'string' ? text.trim().toLowerCase() : '';
}

function compressCompareText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, '').toLowerCase() : '';
}

function tryAddNameCandidate(set, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach(item => tryAddNameCandidate(set, item));
    return;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (MACHINE_NAME_PLACEHOLDER_REGEX.test(trimmed)) return;
    set.add(trimmed);
    return;
  }
  if (typeof value === 'object') {
    const keys = ['name', 'displayName', 'modelName', 'label', 'title', 'machineName', 'machineModel'];
    for (const key of keys) {
      if (value[key]) tryAddNameCandidate(set, value[key]);
    }
  }
}

function collectMachineNameCandidates(note = {}) {
  const set = new Set();
  tryAddNameCandidate(set, note.machineName);
  tryAddNameCandidate(set, note.machineModel);
  tryAddNameCandidate(set, note.machineDisplayName);
  tryAddNameCandidate(set, note.machineLabel);
  tryAddNameCandidate(set, note.machine);
  tryAddNameCandidate(set, note.machineInfo);
  if (Array.isArray(note.machines)) tryAddNameCandidate(set, note.machines);
  return Array.from(set);
}

async function getMachineCatalog() {
  const now = Date.now();
  if (machineCatalogCache && (now - machineCatalogFetchedAt) < MACHINE_CATALOG_TTL_MS) {
    return machineCatalogCache;
  }
  try {
    const list = await listAllMachines();
    const safeList = Array.isArray(list) ? list : [];
    machineCatalogCache = safeList.map(item => ({
      ...item,
      __compareId: normalizeCompareText(item?.id || ''),
      __compareName: compressCompareText(item?.name || '')
    }));
  } catch (err) {
    console.warn('[MachineUsage] failed to load machine catalog', { message: err?.message });
    machineCatalogCache = [];
  }
  machineCatalogFetchedAt = now;
  return machineCatalogCache;
}

export async function resolveMachineIdForNote(note = {}) {
  const direct = getMachineIdFromNote(note);
  if (direct) return direct;
  const nameCandidates = collectMachineNameCandidates(note);
  if (!nameCandidates.length) return null;
  const catalog = await getMachineCatalog();
  if (!catalog.length) return null;

  for (const candidate of nameCandidates) {
    const compareId = normalizeCompareText(candidate);
    const compareName = compressCompareText(candidate);
    if (compareId) {
      const byId = catalog.find(machine => machine.__compareId === compareId);
      if (byId?.id) return byId.id;
    }
    if (compareName) {
      const byName = catalog.find(machine => machine.__compareName === compareName);
      if (byName?.id) return byName.id;
    }
  }

  for (const candidate of nameCandidates) {
    const compareName = compressCompareText(candidate);
    if (!compareName) continue;
    const partial = catalog.find(machine => machine.__compareName && (machine.__compareName.includes(compareName) || compareName.includes(machine.__compareName)));
    if (partial?.id) return partial.id;
  }

  return null;
}

export function primeMachineCatalogCache(list) {
  if (!Array.isArray(list)) return;
  machineCatalogCache = list.map(item => ({
    ...item,
    __compareId: normalizeCompareText(item?.id || ''),
    __compareName: compressCompareText(item?.name || '')
  }));
  machineCatalogFetchedAt = Date.now();
}

function resetMachineCatalogCache() {
  machineCatalogCache = null;
  machineCatalogFetchedAt = 0;
}

function toDateInstance(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return null; }
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function getUsageDateForMachine(note = {}) {
  const picks = [note.signedAt, note.completedAt, note.date, note.serverCreatedAt, note.createdAt, note.updatedAt];
  for (const value of picks) {
    const date = toDateInstance(value);
    if (date) return date;
  }
  return null;
}

function broadcastMachinesUpdated() {
  try {
    localStorage.setItem('machines_updated_at', Date.now().toString());
    window.dispatchEvent(new CustomEvent('machines-updated'));
  } catch { /* ignore cross-context errors */ }
}

export async function incrementMachineUsageCounter(machineId, { noteDate, reason } = {}) {
  if (!machineId) return false;
  const ref = doc(db, 'machines', machineId);
  const lastUsedAt = toDateInstance(noteDate) || serverTimestamp();
  const payload = {
    usageCount: increment(1),
    updatedAt: serverTimestamp(),
    lastUsedAt
  };
  try {
    await updateDoc(ref, payload);
    broadcastMachinesUpdated();
    console.info('[MachineUsage] incremented machine usage', { machineId, reason });
    return true;
  } catch (error) {
    console.warn('[MachineUsage] increment failed', { machineId, reason, message: error?.message });
    return false;
  }
}

export async function ensureUsageAppliedForDelivery({ docId, noteData, reason } = {}) {
  let data = noteData && typeof noteData === 'object' ? noteData : null;
  let ref = null;
  if (docId) {
    ref = doc(db, 'deliveryNotes', docId);
  }

  const readNoteIfNeeded = async () => {
    if (data && typeof data === 'object') return true;
    if (!ref) return false;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      data = snap.data();
      return true;
    } catch (err) {
      console.warn('[MachineUsage] failed to fetch delivery note for usage check', { docId, reason, message: err?.message });
      return false;
    }
  };

  if (!data) {
    const loaded = await readNoteIfNeeded();
    if (!loaded) return { applied: false, machineId: null, alreadyApplied: false };
  }

  const existingId = getMachineIdFromNote(data || {});
  if (data?.[MACHINE_USAGE_FLAG] === true) {
    return { applied: false, machineId: existingId || null, alreadyApplied: true };
  }

  const resolvedMachineId = existingId || await resolveMachineIdForNote(data || {});
  if (!resolvedMachineId) {
    return { applied: false, machineId: null, alreadyApplied: false };
  }

  const noteDate = getUsageDateForMachine(data || {});
  const success = await incrementMachineUsageCounter(resolvedMachineId, { noteDate, reason });
  if (success) {
    if (data) {
      data[MACHINE_USAGE_FLAG] = true;
      if (!data.machineId) data.machineId = resolvedMachineId;
    }
    if (ref) {
      const updatePayload = {
        [MACHINE_USAGE_FLAG]: true,
        machineUsageAppliedAt: serverTimestamp()
      };
      if (!existingId) updatePayload.machineId = resolvedMachineId;
      try {
        await updateDoc(ref, updatePayload);
      } catch (err) {
        console.warn('[MachineUsage] failed to mark usage applied', { docId, reason, message: err?.message });
      }
    }
  }

  return { applied: success, machineId: resolvedMachineId, alreadyApplied: false };
}

try {
  window.addEventListener('machines-updated', resetMachineCatalogCache);
  window.addEventListener('storage', (event) => {
    if (event?.key === 'machines_updated_at') resetMachineCatalogCache();
  });
} catch { /* ignore non-browser contexts */ }
