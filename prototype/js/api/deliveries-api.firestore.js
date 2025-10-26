// deliveries-api.firestore.js
// Firestore 實作：負責 deliveryNotes 集合的建立與查詢
import { db } from '../../firebase-init.js';
import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit as qlimit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { getUserContext } from '../session-context.js';

const notesCol = collection(db, 'deliveryNotes');

const tsToIso = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return v;
};

export async function createDelivery(input) {
  const payload = {
    ...input,
    offline: false,
    serverCreatedAt: serverTimestamp()
  };
  if (!Array.isArray(payload.assignedTo)) payload.assignedTo = [];
  if (!Array.isArray(payload.readableBy)) payload.readableBy = [];
  const ref = await addDoc(notesCol, payload);
  return ref.id;
}

export async function listHistoryDeliveries(limit = 100) {
  const { uid, role } = await getUserContext();
  const map = new Map();
  const pushDocs = (snap) => {
    if (!snap) return;
    snap.forEach((docSnap) => {
      if (!docSnap?.exists()) return;
      const data = docSnap.data() || {};
      map.set(docSnap.id, {
        id: docSnap.id,
        ...data,
        createdAt: tsToIso(data.createdAt),
        serverCreatedAt: tsToIso(data.serverCreatedAt)
      });
    });
  };

  try {
    if (role === 'manager') {
      try {
        const q1 = query(notesCol, orderBy('serverCreatedAt', 'desc'), qlimit(limit));
        pushDocs(await getDocs(q1));
      } catch (err) {
        const q2 = query(notesCol, qlimit(limit));
        pushDocs(await getDocs(q2));
      }
    } else {
      if (!uid) return [];
      const loadLimit = Math.max(limit * 2, 50);
      const tasks = [
        query(notesCol, where('readableBy', 'array-contains', uid), qlimit(loadLimit)),
        query(notesCol, where('assignedTo', 'array-contains', uid), qlimit(loadLimit)),
        query(notesCol, where('createdBy', '==', uid), qlimit(loadLimit))
      ];
      for (const qRef of tasks) {
        try {
          pushDocs(await getDocs(qRef));
        } catch (err) {
          // ignore individual query errors (e.g. missing index)
        }
      }
    }
  } catch (err) {
    console.warn('[API] listHistoryDeliveries fallback triggered', err);
  }

  const rows = Array.from(map.values());
  rows.sort((a, b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
  return rows.slice(0, limit);
}

export async function listPendingDeliveries(limit = 100) {
  const { uid, role } = await getUserContext();
  if (role === 'manager') {
    try {
      const q1 = query(
        notesCol,
        where('signatureStatus', '==', 'pending'),
        orderBy('serverCreatedAt', 'desc'),
        qlimit(limit)
      );
      const snap = await getDocs(q1);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      const q2 = query(notesCol, where('signatureStatus', '==', 'pending'), qlimit(limit));
      const snap = await getDocs(q2);
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rows.sort((a, b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
      return rows.slice(0, limit);
    }
  }

  if (!uid) return [];
  const history = await listHistoryDeliveries(limit * 3);
  return history.filter(x => (x.signatureStatus || 'pending') === 'pending').slice(0, limit);
}

console.info('[API] deliveries-api.firestore.js ready');
