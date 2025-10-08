// machines-api.firestore.js
// Firestore 實作：負責存取 machineCategories 與 machines 集合
import { db } from '../../firebase-init.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const machinesCol = collection(db, 'machines');
const categoriesCol = collection(db, 'machineCategories');

const timestampToIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toFirestoreDate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value?.toDate === 'function') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const toMachineModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: data.name || '',
    categoryId: data.categoryId ?? null,
    isActive: data.isActive !== false,
    usageCount: data.usageCount ?? 0,
    lastUsedAt: timestampToIso(data.lastUsedAt),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
};

const toCategoryModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: data.name || '',
    isActive: data.isActive !== false,
    order: data.order ?? 0,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
};

export async function listActiveMachines() {
  const q = query(machinesCol, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(toMachineModel);
}

export async function listAllMachines() {
  const snap = await getDocs(machinesCol);
  return snap.docs.map(toMachineModel);
}

export async function createMachine(input) {
  const now = serverTimestamp();
  const payload = {
    name: input.name?.trim() ?? '',
    categoryId: input.categoryId || null,
    isActive: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const ref = await addDoc(machinesCol, payload);
  const latest = await getDoc(ref);
  return toMachineModel(latest);
}

export async function updateMachine(id, patch) {
  const ref = doc(machinesCol, id);
  const updates = { updatedAt: serverTimestamp() };

  if (patch.name !== undefined) updates.name = patch.name?.trim() ?? '';
  if (patch.categoryId !== undefined) updates.categoryId = patch.categoryId || null;
  if (patch.isActive !== undefined) updates.isActive = !!patch.isActive;
  if (patch.usageCount !== undefined) updates.usageCount = Number(patch.usageCount) || 0;
  if (patch.lastUsedAt !== undefined) updates.lastUsedAt = toFirestoreDate(patch.lastUsedAt);

  await updateDoc(ref, updates);
  const latest = await getDoc(ref);
  return toMachineModel(latest);
}

export async function listCategories() {
  const snap = await getDocs(categoriesCol);
  return snap.docs
    .map(toCategoryModel)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createCategory(input) {
  const base = (input.id || input.slug || input.name || '').trim();
  if (!base) throw new Error('Category name is required');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
  const now = serverTimestamp();
  const ref = doc(categoriesCol, slug);
  await setDoc(ref, {
    name: input.name?.trim() || base,
    isActive: true,
    order: input.order ?? 50,
    createdAt: now,
    updatedAt: now
  });
  const latest = await getDoc(ref);
  return toCategoryModel(latest);
}

export async function updateCategory(id, patch) {
  const ref = doc(categoriesCol, id);
  const updates = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) updates.name = patch.name?.trim() ?? '';
  if (patch.isActive !== undefined) updates.isActive = !!patch.isActive;
  if (patch.order !== undefined) updates.order = Number(patch.order) || 0;

  await updateDoc(ref, updates);
  const latest = await getDoc(ref);
  return toCategoryModel(latest);
}
