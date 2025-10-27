// drivers-api.firestore.js
// Firestore 實作：users 集合（role=='driver'）為司機來源
// 注意：為了避免瀏覽器快取導致 firebase-init.js 尚未提供 named export `functions`
// 這裡採用彈性取得 Functions 的方式（優先使用 firebase-init.js 匯出的 functions，否則自行 getFunctions 並在本機時連 emulator）。
import * as appInit from '../../firebase-init.js';
import { db } from '../../firebase-init.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-functions.js';
import {
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const usersCol = collection(db, 'users');

// 準備 Functions 服務；優先採用 firebase-init.js 匯出的 functions，其次自行 getFunctions。
let functionsSvc = appInit?.functions;
try {
  if (!functionsSvc) {
    const app = getApp();
    functionsSvc = getFunctions(app, 'asia-east1');
    // 在本機環境自動連 Emulator（若 firebase-init 已連接過，第二次呼叫不會有副作用）
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      try { connectFunctionsEmulator(functionsSvc, 'localhost', 5001); } catch (e) { /* ignore */ }
    }
  }
} catch (e) {
  console.warn('[drivers-api] init functions failed, callable will not work:', e);
}

function callDriverFunction(name, payload) {
  if (!functionsSvc) throw new Error('Cloud Functions not initialized');
  const callable = httpsCallable(functionsSvc, name);
  return callable(payload).then((res) => res?.data ?? null);
}

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
  let payload = {};
  if (typeof input === 'string') {
    payload.displayName = input.trim();
  } else if (typeof input === 'object' && input !== null) {
    payload.displayName = (input.displayName || '').toString().trim();
    payload.isActive = input.isActive !== false;
    payload.email = input.email ?? null;
    payload.phone = input.phone ?? null;
    payload.licenseNo = input.licenseNo ?? null;
  } else {
    throw new Error('createDriver: invalid input');
  }

  if (!payload.displayName) {
    throw new Error('Driver displayName is required');
  }

  const response = await callDriverFunction('createDriverAccount', payload);
  if (!response?.driver) {
    throw new Error('createDriverAccount response missing driver payload');
  }
  return response.driver;
}

export async function updateDriver(id, patch) {
  if (!id) throw new Error('updateDriver: id is required');
  const response = await callDriverFunction('updateDriverAccount', { id, ...patch });
  return response?.driver ?? null;
}

export async function deleteDriver(id) {
  if (!id) throw new Error('deleteDriver: id is required');
  await callDriverFunction('deleteDriverAccount', { id });
  return true;
}