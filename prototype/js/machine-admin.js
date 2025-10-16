import { listAllMachines, listCategories, createMachine, updateMachine, deleteMachine } from './api/index.v2.js';

const tableBody = document.querySelector('#machineTable tbody');
const alertBox = document.getElementById('alertBox');
const addBtn = document.getElementById('addMachineBtn');
const modalEl = document.getElementById('machineModal');
const modal = new bootstrap.Modal(modalEl);
const form = document.getElementById('machineForm');
const modalTitle = document.getElementById('modalTitle');
const nameInput = document.getElementById('machineName');
const categorySelect = document.getElementById('machineCategory');
const activeInput = document.getElementById('machineActive');
const saveBtn = document.getElementById('saveBtn');

let editingId = null;
let categories = [];
let machinesCache = [];

const DEFAULT_CATEGORIES = [
  { id: 'dispatch', name: '派送' },
  { id: 'maintenance', name: '維修' },
  { id: 'standby', name: '待命中' }
];

function showAlert(msg, type = 'danger') {
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
  setTimeout(() => alertBox.classList.add('d-none'), 3000);
}

function getAllCategories() {
  const map = new Map();
  DEFAULT_CATEGORIES.forEach(c => map.set(c.id, c));
  categories.forEach(c => map.set(c.id, c));
  return Array.from(map.values());
}

function renderCategoryOptions(selectedId = '') {
  if (!categorySelect) return;
  const allCats = getAllCategories();
  
  categorySelect.innerHTML = `
    <option value="" disabled ${!selectedId ? 'selected' : ''}>請選擇類別</option>
    ${allCats.map(cat => `<option value="${cat.id}" ${cat.id === selectedId ? 'selected' : ''}>${cat.name}</option>`).join('')}
  `;
}

function updateStats(machines) {
  document.getElementById('totalCount').textContent = machines.length;
  document.getElementById('activeCount').textContent = machines.filter(m => m.isActive).length;
  document.getElementById('inactiveCount').textContent = machines.filter(m => !m.isActive).length;
  document.getElementById('totalUsage').textContent = machines.reduce((sum, m) => sum + (m.usageCount || 0), 0);
}

function renderTable(machines) {
  const allCats = getAllCategories();
  tableBody.innerHTML = machines.map(m => `
    <tr data-machine-id="${m.id}">
      <td>${m.name}</td>
      <td>${allCats.find(c => c.id === m.categoryId)?.name || '-'}</td>
      <td>${m.isActive ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>'}</td>
      <td>
        <input type="number" class="form-control form-control-sm usage-input" 
               data-id="${m.id}" value="${m.usageCount ?? 0}" min="0" style="width: 80px;">
      </td>
      <td>${m.lastUsedAt ? new Date(m.lastUsedAt).toLocaleString('zh-TW') : '-'}</td>
      <td>
        <button class="btn btn-sm btn-secondary edit-btn" data-id="${m.id}" type="button">編輯</button>
        <button class="btn btn-sm btn-${m.isActive ? 'warning' : 'success'} toggle-btn" data-id="${m.id}" type="button">
          ${m.isActive ? '停用' : '啟用'}
        </button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${m.id}" type="button">刪除</button>
      </td>
    </tr>
  `).join('');
  updateStats(machines);
  
  // 重新綁定事件
  attachTableEvents();
}

function attachTableEvents() {
  // 編輯按鈕
  tableBody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      editingId = id;
      modalTitle.textContent = '編輯機具';
      const machine = machinesCache.find(m => m.id === id);
      if (!machine) return showAlert('找不到機具資料');

      nameInput.value = machine.name;
      renderCategoryOptions(machine.categoryId);
      activeInput.checked = !!machine.isActive;
      modal.show();
    };
  });

  // 啟用/停用按鈕
  tableBody.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        const machine = machinesCache.find(m => m.id === id);
        if (!machine) throw new Error('not-found');
        await updateMachine(id, { isActive: !machine.isActive, updatedAt: Date.now() });
        showAlert(`已${machine.isActive ? '停用' : '啟用'}機具`, 'success');
        await refreshTable();
      } catch (err) {
        console.error('Toggle error:', err);
        showAlert('狀態切換失敗');
        btn.disabled = false;
      }
    };
  });

  // 刪除按鈕
  tableBody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const machine = machinesCache.find(m => m.id === id);
      if (!confirm(`確定要刪除「${machine?.name || '此機具'}」嗎？`)) return;
      
      btn.disabled = true;
      try {
        await deleteMachine(id);
        showAlert('刪除成功', 'success');
        await refreshTable();
      } catch (err) {
        console.error('Delete error:', err);
        showAlert('刪除失敗');
        btn.disabled = false;
      }
    };
  });

  // 使用次數輸入框
  tableBody.querySelectorAll('.usage-input').forEach(input => {
    input.onchange = async () => {
      const id = input.dataset.id;
      const newCount = parseInt(input.value, 10);
      if (isNaN(newCount) || newCount < 0) {
        showAlert('使用次數必須是非負整數');
        await refreshTable();
        return;
      }
      try {
        input.disabled = true;
        await updateMachine(id, { usageCount: newCount, updatedAt: Date.now() });
        showAlert('使用次數已更新', 'success');
        await refreshTable();
      } catch (err) {
        console.error('Update usage error:', err);
        showAlert('更新失敗');
        input.disabled = false;
      }
    };
  });
}

async function loadCategories() {
  try {
    const data = await listCategories();
    categories = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Load categories error:', err);
    categories = [];
  }
}

async function refreshTable() {
  saveBtn.disabled = false;
  await loadCategories();
  try {
    machinesCache = await listAllMachines();
    renderTable(machinesCache);
  } catch (err) {
    console.error('Refresh table error:', err);
    showAlert('載入機具失敗');
  }
}

addBtn.onclick = () => {
  editingId = null;
  modalTitle.textContent = '新增機具';
  form.reset();
  renderCategoryOptions('');
  activeInput.checked = true;
  modal.show();
};

form.addEventListener('submit', async e => {
  e.preventDefault();
  saveBtn.disabled = true;

  const name = nameInput.value.trim();
  const categoryId = categorySelect.value;
  const isActive = activeInput.checked;

  if (!name) {
    showAlert('名稱不可空');
    saveBtn.disabled = false;
    return;
  }
  if (!categoryId) {
    showAlert('類別必須選擇');
    saveBtn.disabled = false;
    return;
  }

  try {
    if (editingId) {
      await updateMachine(editingId, { name, categoryId, isActive, updatedAt: Date.now() });
      showAlert('更新成功', 'success');
    } else {
      await createMachine({ name, categoryId, isActive, usageCount: 0, updatedAt: Date.now() });
      showAlert('新增成功', 'success');
    }
    modal.hide();
    await refreshTable();
  } catch (err) {
    console.error('Save error:', err);
    showAlert('儲存失敗');
  }
  
  saveBtn.disabled = false;
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 機具管理頁面初始化...');
  refreshTable();
});