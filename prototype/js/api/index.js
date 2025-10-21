// API layer for Categories (Mock + Firestore)
import { db } from '../../firebase-init.js';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  serverTimestamp, query, orderBy
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const USE_MOCK = window.APP_FLAGS?.USE_MOCK_DATA === true;

// ---- Mock implementation (in-memory) ----
const __mock = {
  idSeq: 1,
  categories: []
};

function mockListCategories() {
  return __mock.categories
    .slice()
    .sort((a,b) => (Number(a.order)||0) - (Number(b.order)||0) || String(a.name||'').localeCompare(String(b.name||'')));
}

function mockCreateCategory({ name, order, active }) {
  const item = {
    id: 'mc' + (__mock.idSeq++),
    name,
    active: !!active,
    order: Number(order)||0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  __mock.categories.push(item);
  return item;
}

function mockUpdateCategory(id, patch) {
  const it = __mock.categories.find(x => x.id === id);
  if (it) {
    Object.assign(it, patch);
    it.updatedAt = new Date();
  }
  return it;
}

// ---- Firestore implementation ----
function fsColl() { return collection(db, 'machineCategories'); }

async function fsListCategories() {
  const qy = query(fsColl(), orderBy('order','asc'), orderBy('name','asc'));
  const snap = await getDocs(qy);
  const list = [];
  snap.forEach(docu => list.push({ id: docu.id, ...docu.data() }));
  return list;
}

async function fsCreateCategory({ name, order, active }) {
  const payload = {
    name,
    active: !!active,
    order: Number(order)||0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(fsColl(), payload);
  return { id: ref.id, ...payload };
}

async function fsUpdateCategory(id, patch) {
  await updateDoc(doc(db, 'machineCategories', id), {
    ...patch,
    updatedAt: serverTimestamp()
  });
  return true;
}

// ---- Public API ----
export function getApiSource() { return USE_MOCK ? 'mock' : 'firestore'; }
export async function listCategories() {
  return USE_MOCK ? mockListCategories() : fsListCategories();
}
export async function createCategory(dto) {
  return USE_MOCK ? mockCreateCategory(dto) : fsCreateCategory(dto);
}
export async function updateCategory(id, patch) {
  return USE_MOCK ? mockUpdateCategory(id, patch) : fsUpdateCategory(id, patch);
}
