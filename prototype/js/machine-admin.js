import { listAllMachines, listCategories, createMachine, updateMachine, deleteMachine } from './api/index.v2.js';
import { resolveMachineIdForNote, getUsageDateForMachine, primeMachineCatalogCache } from './machine-usage.js';
import { db } from '../firebase-init.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

const tableBody = document.querySelector('#machineTable tbody');
const alertBox = document.getElementById('alertBox');
const addBtn = document.getElementById('addMachineBtn');
const modalEl = document.getElementById('machineModal');
const modal = new bootstrap.Modal(modalEl);
const form = document.getElementById('machineForm');
const modalTitle = document.getElementById('modalTitle');
const nameInput = document.getElementById('machineName');
const vehicleInput = document.getElementById('machineVehicle');
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

function toTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

async function fetchCompletedDeliveryNotes() {
  const useMock = window.APP_FLAGS?.USE_MOCK_DATA === true;
  if (useMock) {
    return { list: [], source: 'mock' };
  }
  try {
    const completedQuery = query(collection(db, 'deliveryNotes'), where('signatureStatus', '==', 'completed'));
    const snap = await getDocs(completedQuery);
    return { list: snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })), source: 'firestore' };
  } catch (err) {
    console.warn('[MachineAdmin] 無法載入已簽章簽單', err);
    return { list: [], source: 'error' };
  }
}

async function buildUsageMapFromSignedNotes(machines) {
  const usageMap = new Map();
  let total = 0;

  const useMock = window.APP_FLAGS?.USE_MOCK_DATA === true;
  if (useMock) {
    machines.forEach(machine => {
      const count = machine.usageCount ?? 0;
      usageMap.set(machine.id, {
        count,
        lastUsedAt: toTimestamp(machine.lastUsedAt)
      });
      total += count;
    });
    return { usageMap, total };
  }

  const { list: notes, source } = await fetchCompletedDeliveryNotes();
  if (source === 'error') {
    machines.forEach(machine => {
      const count = machine.usageCount ?? 0;
      usageMap.set(machine.id, {
        count,
        lastUsedAt: toTimestamp(machine.lastUsedAt)
      });
      total += count;
    });
    return { usageMap, total };
  }

  if (!notes.length) {
    return { usageMap, total: 0 };
  }

  console.info('[MachineAdmin] 依簽單重新統計機具使用次數', { completedCount: notes.length });

  for (const note of notes) {
    try {
      const machineId = await resolveMachineIdForNote(note);
      if (!machineId) continue;
      const entry = usageMap.get(machineId) || { count: 0, lastUsedAt: null };
      entry.count += 1;
      total += 1;
      const usageDate = getUsageDateForMachine(note);
      if (usageDate) {
        const ts = usageDate.getTime();
        if (!entry.lastUsedAt || ts > entry.lastUsedAt) {
          entry.lastUsedAt = ts;
        }
      }
      usageMap.set(machineId, entry);
    } catch (err) {
      console.warn('[MachineAdmin] 無法解析簽單的機具資訊', { noteId: note?.id, message: err?.message });
    }
  }

  return { usageMap, total };
}

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

function updateStats(machines, overrideTotalUsage = null) {
  document.getElementById('totalCount').textContent = machines.length;
  document.getElementById('activeCount').textContent = machines.filter(m => m.isActive).length;
  document.getElementById('inactiveCount').textContent = machines.filter(m => !m.isActive).length;
  const total = overrideTotalUsage !== null ? overrideTotalUsage : machines.reduce((sum, m) => sum + (m.usageCount || 0), 0);
  document.getElementById('totalUsage').textContent = total;
}

function renderTable(machines, usageSummary = null) {
  const allCats = getAllCategories();
  tableBody.innerHTML = machines.map(m => `
    <tr data-machine-id="${m.id}">
      <td>${m.name}</td>
      <td>${m.vehicleNumber || '-'}</td>
      <td>${allCats.find(c => c.id === m.categoryId)?.name || '-'}</td>
      <td>${m.isActive ? '<span class="badge bg-success">啟用</span>' : '<span class="badge bg-secondary">停用</span>'}</td>
      <td><span class="badge bg-info text-dark">${m.usageCount ?? 0}</span></td>
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
  updateStats(machines, usageSummary?.total ?? null);
  
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
      if (vehicleInput) vehicleInput.value = machine.vehicleNumber || '';
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
        // notify other tabs/pages that machines changed
        try { localStorage.setItem('machines_updated_at', Date.now().toString()); window.dispatchEvent(new CustomEvent('machines-updated')); } catch(e){}
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
        try { localStorage.setItem('machines_updated_at', Date.now().toString()); window.dispatchEvent(new CustomEvent('machines-updated')); } catch(e){}
      } catch (err) {
        console.error('Delete error:', err);
        showAlert('刪除失敗');
        btn.disabled = false;
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
    primeMachineCatalogCache(machinesCache);
    const usageStats = await buildUsageMapFromSignedNotes(machinesCache);
    machinesCache = machinesCache.map(machine => {
      const usage = usageStats.usageMap.get(machine.id);
      const rawFallback = toTimestamp(machine.lastUsedAt);
      const lastUsedMs = usage?.lastUsedAt ?? rawFallback;
      const hasTimestamp = Number.isFinite(lastUsedMs);
      return {
        ...machine,
        usageCount: usage?.count ?? 0,
        lastUsedAt: hasTimestamp ? new Date(lastUsedMs).toISOString() : null
      };
    });
    renderTable(machinesCache, usageStats);
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
  if (vehicleInput) vehicleInput.value = '';
  activeInput.checked = true;
  modal.show();
};

form.addEventListener('submit', async e => {
  e.preventDefault();
  saveBtn.disabled = true;

  const name = nameInput.value.trim();
  const vehicleNumber = vehicleInput ? vehicleInput.value.trim() : '';
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
  if (vehicleInput && !vehicleNumber) {
    showAlert('車號不可空');
    saveBtn.disabled = false;
    return;
  }

  try {
    if (editingId) {
      await updateMachine(editingId, { name, vehicleNumber, categoryId, isActive, updatedAt: Date.now() });
      showAlert('更新成功', 'success');
    } else {
      await createMachine({ name, vehicleNumber, categoryId, isActive, usageCount: 0, updatedAt: Date.now() });
      showAlert('新增成功', 'success');
    }
    modal.hide();
    await refreshTable();
    try { localStorage.setItem('machines_updated_at', Date.now().toString()); window.dispatchEvent(new CustomEvent('machines-updated')); } catch(e){}
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