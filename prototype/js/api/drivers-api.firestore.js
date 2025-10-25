// drivers-api.firestore.js
// Firestore 實作：users 集合（role=='driver'）為司機來源
import { db } from '../../firebase-init.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const usersCol = collection(db, 'users');

const timestampToIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toDriverModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: data.uid || snapshot.id,
    displayName: data.displayName || data.name || '',
    role: data.role || 'driver',
    isActive: data.isActive !== false,
    email: data.email ?? null,
    phone: data.phone ?? null,
    licenseNo: data.licenseNo ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
};

const toManagerModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: data.uid || snapshot.id,
    displayName: data.displayName || data.name || '',
    role: data.role || 'manager',
    isActive: data.isActive !== false,
    email: data.email ?? null,
    phone: data.phone ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
};

export async function listActiveDrivers() {
  // 以 role=driver 且 isActive=true 查詢
  const q = query(usersCol, where('role', '==', 'driver'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(toDriverModel);
}

export async function listAllDrivers() {
  const q = query(usersCol, where('role', '==', 'driver'));
  const snap = await getDocs(q);
  return snap.docs.map(toDriverModel);
}

// Managers listing (users with role === 'manager')
export async function listActiveManagers() {
  const q = query(usersCol, where('role', '==', 'manager'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(toManagerModel);
}

export async function listAllManagers() {
  const q = query(usersCol, where('role', '==', 'manager'));
  const snap = await getDocs(q);
  return snap.docs.map(toManagerModel);
}

/**
 * createDriver(input)
 * input 可為 string (displayName) 或 object:
 * { displayName, isActive, email, phone, licenseNo }
 *
 * 預設 isActive = false（除非明確傳入 isActive === true）
 */
export async function createDriver(input) {
  const now = serverTimestamp();

  let payload = {};
  if (typeof input === 'string') {
    payload.displayName = input.trim();
  } else if (typeof input === 'object' && input !== null) {
    payload.displayName = (input.displayName || '').toString().trim();
    payload.isActive = input.isActive === true;
    payload.email = input.email ?? null;
    payload.phone = input.phone ?? null;
    payload.licenseNo = input.licenseNo ?? null;
    if (input.uid !== undefined) {
      const trimmedUid = String(input.uid || '').trim();
      payload.uid = trimmedUid || null;
    }
  } else {
    throw new Error('createDriver: invalid input');
  }

  if (!payload.displayName) {
    throw new Error('Driver displayName is required');
  }

  const docPayload = {
    displayName: payload.displayName,
    role: 'driver',
    isActive: payload.isActive === true ? true : false,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    licenseNo: payload.licenseNo ?? null,
    uid: payload.uid ?? null,
    createdAt: now,
    updatedAt: now
  };

  const ref = await addDoc(usersCol, docPayload);
  const latest = await getDoc(ref);
  return toDriverModel(latest);
}

export async function updateDriver(id, patch) {
  const ref = doc(usersCol, id);
  const updates = { updatedAt: serverTimestamp() };

  if (patch?.displayName !== undefined) updates.displayName = patch.displayName?.toString().trim() ?? '';
  if (patch?.isActive !== undefined) updates.isActive = !!patch.isActive;
  if (patch?.email !== undefined) updates.email = patch.email ?? null;
  if (patch?.phone !== undefined) updates.phone = patch.phone ?? null;
  if (patch?.licenseNo !== undefined) updates.licenseNo = patch.licenseNo ?? null;
  if (patch?.uid !== undefined) {
    const trimmedUid = String(patch.uid || '').trim();
    updates.uid = trimmedUid || null;
  }

  // 如果只有 updatedAt（沒有其他欄位），仍會寫入 updatedAt（視情境可視為允許）
  // 若想嚴格檢查可在此 throw
  await updateDoc(ref, updates);
  const latest = await getDoc(ref);
  return toDriverModel(latest);
}

export async function deleteDriver(id) {
  const ref = doc(usersCol, id);
  await deleteDoc(ref);
  return true;
}