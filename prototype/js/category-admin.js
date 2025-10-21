// category-admin.js - 機具類別管理（透過 API 層）
import { listCategories, createCategory, updateCategory, getApiSource } from './api/index.js';

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

// 由 API 層負責切換 Mock/Firestore

// ---- UI Render ----
function toDateStr(v) {
  if (!v) return '-';
  try {
    if (typeof v.toDate === 'function') {
      // Firestore Timestamp
      v = v.toDate();
    }
    if (v instanceof Date) {
      return v.toISOString().split('T')[0];
    }
    if (typeof v === 'string') {
      return v.split('T')[0];
    }
  } catch {}
  return '-';
}

function renderRows(items) {
  tableBody.innerHTML = '';
  if (!items || items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="text-center text-muted py-4">無資料</td>`;
    tableBody.appendChild(tr); return;
  }
  for (const it of items) {
    const tr = document.createElement('tr');
    const created = toDateStr(it.createdAt);
    tr.innerHTML = `
      <td>${escapeHtml(it.name || '')}</td>
      <td>${it.active ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>'}</td>
      <td>${Number(it.order)||0}</td>
      <td class="small text-muted">${created}</td>
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
    const list = await listCategories();
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
      await updateCategory(id, { active: !nowActive });
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
      await updateCategory(id, { name, order, active });
    } else {
      await createCategory({ name, order, active });
    }
    bsModal?.hide();
    await refresh();
  } catch (e) { showError(modalError, e.message); }
});

// ---- Init ----
modeBadge.textContent = (getApiSource?.() === 'mock') ? 'Mock 模式' : 'Firestore 模式';
modeBadge.className = 'badge ' + (USE_MOCK ? 'bg-secondary' : 'bg-success');
refresh();
