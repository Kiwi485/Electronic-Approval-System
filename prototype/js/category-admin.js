// category-admin.js - 機具類別管理（Firestore + Mock）
import { db } from '../firebase-init.js';
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const USE_MOCK = window.APP_FLAGS?.USE_MOCK_DATA === true;

// UI 元素
const tableBody = document.getElementById('tableBody');
const btnAdd = document.getElementById('btnAdd');
const modeBadge = document.getElementById('modeBadge');
const pageError = document.getElementById('pageError');

// Modal 元素
const editModalEl = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const btnSave = document.getElementById('btnSave');
const editForm = document.getElementById('editForm');
const catIdEl = document.getElementById('catId');
const catNameEl = document.getElementById('catName');
const catOrderEl = document.getElementById('catOrder');
const catActiveEl = document.getElementById('catActive');
const modalError = document.getElementById('modalError');
let bsModal;
if (editModalEl && window.bootstrap) {
  bsModal = new bootstrap.Modal(editModalEl);
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('d-none', !msg);
}

function clearFormErrors() { showError(modalError, ''); }
function resetForm() {
  catIdEl.value = '';
  catNameEl.value = '';
  catOrderEl.value = '';
  catActiveEl.checked = true;
  clearFormErrors();
  editForm.querySelectorAll('.is-invalid').forEach(x => x.classList.remove('is-invalid'));
}

// ---- Repository（Firestore / Mock）----
class MockRepo {
  constructor() { this.items = []; this.idSeq = 1; }
  async list() { return this.items.slice().sort((a,b)=> (a.order||0)-(b.order||0) || a.name.localeCompare(b.name)); }
  async add({ name, active, order }) {
    const item = { id: 'm' + (this.idSeq++), name, active, order: Number(order)||0, createdAt: new Date().toISOString() };
    this.items.push(item); return item;
  }
  async update(id, patch) { const it = this.items.find(x=>x.id===id); if (it) Object.assign(it, patch); return it; }
}

class FsRepo {
  coll() { return collection(db, 'categories'); }
  async list() {
    const qy = query(this.coll(), orderBy('order','asc'), orderBy('name','asc'));
    const snap = await getDocs(qy);
    const list = [];
    snap.forEach(docu => list.push({ id: docu.id, ...docu.data() }));
    return list;
  }
  async add({ name, active, order }) {
    const payload = { name, active: !!active, order: Number(order)||0, createdAt: serverTimestamp() };
    const ref = await addDoc(this.coll(), payload); return { id: ref.id, ...payload };
  }
  async update(id, patch) { await updateDoc(doc(db, 'categories', id), patch); return true; }
}

const repo = USE_MOCK ? new MockRepo() : new FsRepo();

// ---- UI Render ----
function renderRows(items) {
  tableBody.innerHTML = '';
  if (!items || items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="text-center text-muted py-4">無資料</td>`;
    tableBody.appendChild(tr); return;
  }
  for (const it of items) {
    const tr = document.createElement('tr');
    const created = it.createdAt?.toDate ? it.createdAt.toDate().toISOString() : (it.createdAt || '-');
    tr.innerHTML = `
      <td>${escapeHtml(it.name || '')}</td>
      <td>${it.active ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>'}</td>
      <td>${Number(it.order)||0}</td>
      <td class="small text-muted">${created ? created.split('T')[0] : '-'}</td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" data-action="edit" data-id="${it.id}"><i class="bi bi-pencil"></i> 編輯</button>
          <button class="btn ${it.active ? 'btn-outline-warning' : 'btn-outline-success'}" data-action="toggle" data-id="${it.id}">
            <i class="bi ${it.active ? 'bi-pause-circle' : 'bi-play-circle'}"></i> ${it.active ? '停用' : '啟用'}
          </button>
        </div>
      </td>`;
    tableBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

async function refresh() {
  try {
    showError(pageError, '');
    const list = await repo.list();
    renderRows(list);
  } catch (e) { showError(pageError, '載入失敗：' + e.message); }
}

// ---- Events ----
btnAdd?.addEventListener('click', () => {
  resetForm();
  modalTitle.textContent = '新增類別';
  bsModal?.show();
});

tableBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]'); if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  try {
    if (action === 'edit') {
      // 讀取現值（從表格 DOM 取簡化版；正式可從 repo.list() 取快照）
      const tr = btn.closest('tr');
      catIdEl.value = id;
      catNameEl.value = tr.children[0].textContent.trim();
      catActiveEl.checked = tr.children[1].textContent.includes('啟用');
      catOrderEl.value = tr.children[2].textContent.trim();
      modalTitle.textContent = '編輯類別';
      clearFormErrors();
      bsModal?.show();
    } else if (action === 'toggle') {
      // 反轉狀態
      const tr = btn.closest('tr');
      const nowActive = tr.children[1].textContent.includes('啟用');
      await repo.update(id, { active: !nowActive });
      await refresh();
    }
  } catch (err) { alert('操作失敗：' + err.message); }
});

btnSave?.addEventListener('click', async () => {
  clearFormErrors();
  const id = catIdEl.value.trim();
  const name = catNameEl.value.trim();
  const order = Number(catOrderEl.value || 0);
  const active = !!catActiveEl.checked;
  if (!name) { catNameEl.classList.add('is-invalid'); return; }
  try {
    if (id) {
      await repo.update(id, { name, order, active });
    } else {
      await repo.add({ name, order, active });
    }
    bsModal?.hide();
    await refresh();
  } catch (e) { showError(modalError, e.message); }
});

// ---- Init ----
modeBadge.textContent = USE_MOCK ? 'Mock 模式' : 'Firestore 模式';
modeBadge.className = 'badge ' + (USE_MOCK ? 'bg-secondary' : 'bg-success');
refresh();
