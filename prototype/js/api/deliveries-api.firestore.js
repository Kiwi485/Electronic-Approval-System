// deliveries-api.firestore.js
// Firestore 實作：負責 deliveryNotes 集合的建立與查詢
import { db } from '../../firebase-init.js';
import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit as qlimit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

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
  const ref = await addDoc(notesCol, payload);
  return ref.id;
}

export async function listHistoryDeliveries(limit = 100) {
  let snap;
  try {
    const q1 = query(notesCol, orderBy('serverCreatedAt', 'desc'), qlimit(limit));
    snap = await getDocs(q1);
  } catch (e) {
    // 若 serverCreatedAt 尚未建立，退而求其次用 createdAt 排序或直接取全部再排序
    const q2 = query(notesCol, qlimit(limit));
    snap = await getDocs(q2);
  }
  const rows = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    rows.push({ id: doc.id, ...d, createdAt: tsToIso(d.createdAt), serverCreatedAt: tsToIso(d.serverCreatedAt) });
  });
  rows.sort((a,b) => new Date(b.serverCreatedAt || b.createdAt || 0) - new Date(a.serverCreatedAt || a.createdAt || 0));
  return rows.slice(0, limit);
}

export async function listPendingDeliveries(limit = 100) {
  // 提供最小相容：由前端簽章頁面現有查詢邏輯處理，先不實作 where 過濾（或留給後續）
  const data = await listHistoryDeliveries(limit * 3);
  return data.filter(x => (x.signatureStatus || 'pending') === 'pending').slice(0, limit);
}

console.info('[API] deliveries-api.firestore.js ready');
