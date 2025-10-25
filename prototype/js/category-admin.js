// category-admin.js
// 類別管理：machineCategories 集合；欄位對齊使用 isActive

import { db } from '../firebase-init.js';
import {
  collection, getDocs, query, orderBy, addDoc, doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

// ---- Repo 實作 ----------------------------------------------------
class MockRepo {
  constructor() {
    this.items = [
      { id: 'excavator', name: '挖土機', isActive: true, order: 10, createdAt: new Date().toISOString() },
      { id: 'crane', name: '吊車', isActive: true, order: 20, createdAt: new Date().toISOString() },
      { id: 'old-machine', name: '舊機具示範', isActive: false, order: 90, createdAt: new Date().toISOString() }
    ];
  }
  async list() {
    return [...this.items]
      .sort((a,b)=> (a.order??0)-(b.order??0) || a.name.localeCompare(b.name));
  }
  async add(data) {
    const id = data.id || crypto.randomUUID();
    const item = { id, name: data.name, isActive: !!data.isActive, order: Number(data.order)||0, createdAt: new Date().toISOString() };
    this.items.push(item);
    return item;
  }
  async update(id, patch) {
    const idx = this.items.findIndex(x=>x.id===id);
    if (idx<0) throw new Error('not found');
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }
}

class FsRepo {
  constructor(db) { this.db = db; this.coll = collection(db, 'machineCategories'); }
  async list() {
    const q = query(this.coll, orderBy('order','asc'), orderBy('name','asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null }));
  }
  async add(data) {
    // 由於需要自定 id，先 add 再 update 或直接用 add 自動 id
    const payload = { name: data.name, isActive: !!data.isActive, order: Number(data.order)||0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const ref = await addDoc(this.coll, payload);
    return { id: ref.id, ...payload };
  }
  async update(id, patch) {
    const ref = doc(this.db, 'machineCategories', id);
    const toSet = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(ref, toSet);
    return { id, ...patch };
  }
}

// ---- UI 綁定 ------------------------------------------------------
const modeBadge = document.getElementById('modeBadge');
const tbody = document.getElementById('tbody');
const btnAdd = document.getElementById('btnAdd');

const modalEl = document.getElementById('categoryModal');
const modal = new bootstrap.Modal(modalEl);
const modalTitle = document.getElementById('modalTitle');
const iptId = document.getElementById('categoryId');
const iptName = document.getElementById('categoryName');
const iptOrder = document.getElementById('categoryOrder');
const iptActive = document.getElementById('categoryActive');
const btnSave = document.getElementById('btnSave');

// 決定是否使用 mock：在 runtime 讀取 flags（避免模組載入時被鎖定）
function isMock() { return window.APP_FLAGS?.USE_MOCK_DATA === true; }
const mockRepoInstance = new MockRepo();
const fsRepoInstance = new FsRepo(db);
function getRepo() { return isMock() ? mockRepoInstance : fsRepoInstance; }
function updateModeBadge() {
  if (!modeBadge) return;
  const useMockNow = isMock();
  modeBadge.textContent = useMockNow ? 'Mock 模式' : 'Firestore 模式';
  modeBadge.classList.toggle('bg-secondary', useMockNow);
  modeBadge.classList.toggle('bg-success', !useMockNow);
}

async function refresh() {
  updateModeBadge();
  const rows = await getRepo().list();
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>
        <div class="form-check form-switch">
          <input type="checkbox" class="form-check-input toggle-active" data-id="${r.id}" ${r.isActive? 'checked':''} />
        </div>
      </td>
      <td>${r.order ?? 0}</td>
      <td>${r.createdAt ? formatTime(r.createdAt) : '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // 綁定事件（委派）
  tbody.querySelectorAll('.toggle-active').forEach(el=>{
    el.addEventListener('change', async (e)=>{
      const id = e.currentTarget.dataset.id;
      await getRepo().update(id, { isActive: e.currentTarget.checked });
      // 即時刷新
      await refresh();
    });
  });
  tbody.querySelectorAll('.btn-edit').forEach(el=>{
    el.addEventListener('click', async (e)=>{
      const id = e.currentTarget.dataset.id;
      const list = await getRepo().list();
      const found = list.find(x=>x.id===id);
      if (!found) return;
      iptId.value = found.id;
      iptName.value = found.name || '';
      iptOrder.value = found.order ?? 0;
      iptActive.checked = !!found.isActive;
      modalTitle.textContent = '編輯類別';
      modal.show();
    });
  });
}

btnAdd.addEventListener('click', ()=>{
  iptId.value = '';
  iptName.value = '';
  iptOrder.value = 10;
  iptActive.checked = true;
  modalTitle.textContent = '新增類別';
  modal.show();
});

btnSave.addEventListener('click', async ()=>{
  const id = iptId.value.trim();
  const name = iptName.value.trim();
  const order = Number(iptOrder.value)||0;
  const isActive = !!iptActive.checked;
  if (!name) { alert('請輸入名稱'); return; }
  if (id) {
    await getRepo().update(id, { name, order, isActive });
  } else {
    await getRepo().add({ name, order, isActive });
  }
  modal.hide();
  await refresh();
});

function escapeHtml(s='') {
  return s.replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}
function formatTime(t){
  try{ return new Date(t).toLocaleString(); }catch{ return '-'; }
}

// 初始載入
refresh();
