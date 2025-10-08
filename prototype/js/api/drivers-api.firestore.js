// drivers-api.firestore.js
// Firestore 實作：目前僅讀取既有司機 (users 集合)
import { db } from '../../firebase-init.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const usersCol = collection(db, 'users');

const toDriverModel = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    displayName: data.displayName || data.name || '',
    role: data.role || 'driver',
    isActive: data.isActive !== false,
    email: data.email || null
  };
};

export async function listActiveDrivers() {
  const q = query(usersCol, where('role', '==', 'driver'));
  const snap = await getDocs(q);
  return snap.docs
    .map(toDriverModel)
    .filter((driver) => driver.isActive);
}

export async function listAllDrivers() {
  const q = query(usersCol, where('role', '==', 'driver'));
  const snap = await getDocs(q);
  return snap.docs.map(toDriverModel);
}

export async function createDriver() {
  throw new Error('drivers-api.firestore: 尚未支援建立司機 (TODO)');
}

export async function updateDriver(id, patch) {
  const ref = doc(usersCol, id);
  const updates = {};
  if (patch?.displayName !== undefined) updates.displayName = patch.displayName?.trim() ?? '';
  if (patch?.isActive !== undefined) updates.isActive = !!patch.isActive;

  if (Object.keys(updates).length === 0) {
    // 目前僅支援啟停狀態與名稱
    throw new Error('drivers-api.firestore: 無可更新欄位');
  }

  await updateDoc(ref, updates);
  const latest = await getDoc(ref);
  return toDriverModel(latest);
}
