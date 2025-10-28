import { listAllDrivers, createDriver, updateDriver, deleteDriver } from './api/index.js';
import { getUserContext } from './session-context.js';

const tableBody = document.querySelector('#driverTable tbody');
const alertBox = document.getElementById('alertBox');
const addBtn = document.getElementById('addDriverBtn');
const modalEl = document.getElementById('driverModal');
const form = document.getElementById('driverForm');
const modalTitle = document.getElementById('modalTitle');
const totalCountEl = document.getElementById('totalCount');
const activeCountEl = document.getElementById('activeCount');
const inactiveCountEl = document.getElementById('inactiveCount');

const nameInput = document.getElementById('driverName');
const emailInput = document.getElementById('driverEmail');
const phoneInput = document.getElementById('driverPhone');
const licenseInput = document.getElementById('driverLicense');
const activeInput = document.getElementById('driverActive');
const saveBtn = document.getElementById('saveBtn');
const savingSpinner = document.getElementById('savingSpinner');

const modal = new bootstrap.Modal(modalEl);
let driversCache = [];
let editingId = null;
let isReadOnly = false; // 非管理者時僅顯示、不可操作

function resetStats() {
  if (!totalCountEl) return;
  totalCountEl.textContent = '-';
  activeCountEl.textContent = '-';
  inactiveCountEl.textContent = '-';
}

function updateStats(drivers) {
  if (!totalCountEl) return;
  const total = drivers.length;
  const active = drivers.filter(driver => driver.isActive).length;
  const inactive = total - active;
  totalCountEl.textContent = total;
  activeCountEl.textContent = active;
  inactiveCountEl.textContent = inactive;
}

function showAlert(message, variant = 'danger', duration = 2600) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${variant} alert-floating`;
  alertBox.classList.remove('d-none');

  if (duration > 0) {
    setTimeout(() => alertBox.classList.add('d-none'), duration);
  }
}

function hideAlert() {
  alertBox.classList.add('d-none');
}

function normalizeOptional(value) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function renderStatusBadge(isActive) {
  return isActive
    ? '<span class="badge bg-success">啟用</span>'
    : '<span class="badge bg-secondary">停用</span>';
}

function renderTable(drivers) {
  updateStats(drivers);
  if (!drivers.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          尚無司機資料，請點選「新增司機」新增一筆。
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = drivers
    .map((driver) => `
      <tr data-driver-id="${driver.id}">
        <td>
          <div class="fw-semibold">${driver.displayName || '-'}</div>
          <div class="text-muted small">ID: ${driver.id}</div>
        </td>
        <td><span class="badge bg-info text-dark">driver</span></td>
        <td>${renderStatusBadge(driver.isActive)}</td>
        <td>${driver.email ?? '—'}</td>
        <td>${driver.phone ?? '—'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary edit-btn" data-id="${driver.id}" ${isReadOnly ? 'disabled' : ''}>
              <i class="bi bi-pencil-square me-1"></i>編輯
            </button>
            <button class="btn btn-outline-${driver.isActive ? 'warning' : 'success'} toggle-btn" data-id="${driver.id}" ${isReadOnly ? 'disabled' : ''}>
              <i class="bi ${driver.isActive ? 'bi-slash-circle' : 'bi-check-circle'} me-1"></i>${driver.isActive ? '停用' : '啟用'}
            </button>
            <button class="btn btn-outline-danger delete-btn" data-id="${driver.id}" ${isReadOnly ? 'disabled' : ''}>
              <i class="bi bi-trash me-1"></i>刪除
            </button>
          </div>
        </td>
      </tr>
    `)
    .join('');

  if (!isReadOnly) attachRowHandlers();
}

function attachRowHandlers() {
  tableBody.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  tableBody.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const driver = driversCache.find((d) => d.id === id);
      if (!driver) return;

      btn.disabled = true;
      try {
        await updateDriver(id, { isActive: !driver.isActive });
        showAlert(`已${driver.isActive ? '停用' : '啟用'}司機`, 'success');
        await refreshTable();
      } catch (error) {
        console.error('Toggle driver failed:', error);
        const codeRaw = error?.code || error?.details?.code || '';
        const code = (typeof codeRaw === 'string') ? codeRaw.replace(/^functions\//, '') : '';
        if (code === 'permission-denied') {
          showAlert('沒有權限：此操作僅限管理者', 'warning', 4000);
        } else if (code === 'unauthenticated') {
          showAlert('請先登入後再試', 'warning', 4000);
        } else if (/unavailable|deadline-exceeded/i.test(String(error))) {
          showAlert('服務暫時不可用，請確認 Functions 是否啟動', 'warning', 5000);
        } else {
          showAlert('狀態切換失敗，請稍後再試');
        }
        btn.disabled = false;
      }
    });
  });

  tableBody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const driver = driversCache.find((d) => d.id === id);
      if (!driver) return;

      const confirmDelete = window.confirm(`確定要刪除「${driver.displayName || '此司機'}」嗎？`);
      if (!confirmDelete) return;

      btn.disabled = true;
      try {
        await deleteDriver(id);
        showAlert('刪除成功', 'success');
        await refreshTable();
      } catch (error) {
        console.error('Delete driver failed:', error);
        showAlert('刪除失敗，請稍後再試');
        btn.disabled = false;
      }
    });
  });
}

function openCreateModal() {
  editingId = null;
  modalTitle.textContent = '新增司機';
  form.reset();
  activeInput.checked = true;
  hideAlert();
  modal.show();
}

function openEditModal(id) {
  const driver = driversCache.find((d) => d.id === id);
  if (!driver) {
    showAlert('找不到司機資料');
    return;
  }

  editingId = id;
  modalTitle.textContent = '編輯司機';
  nameInput.value = driver.displayName ?? '';
  emailInput.value = driver.email ?? '';
  phoneInput.value = driver.phone ?? '';
  licenseInput.value = driver.licenseNo ?? '';
  activeInput.checked = driver.isActive ?? false;

  hideAlert();
  modal.show();
}

async function refreshTable() {
  try {
    driversCache = await listAllDrivers();
    renderTable(driversCache);
  } catch (error) {
    console.error('Load drivers failed:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          載入司機資料失敗，請重新整理頁面或稍後再試。
        </td>
      </tr>`;
    resetStats();
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = nameInput.value.trim();

  if (!displayName) {
    showAlert('姓名為必填欄位');
    return;
  }

  // 新增司機時 Email 必填（需要建立 Auth 帳號）
  if (!editingId) {
    const email = (emailInput.value || '').trim();
    if (!email) {
      showAlert('Email 為必填，建立帳號需使用 Email');
      return;
    }
  }

  const payload = {
    displayName,
    email: normalizeOptional(emailInput.value),
    phone: normalizeOptional(phoneInput.value),
    licenseNo: normalizeOptional(licenseInput.value),
    isActive: activeInput.checked
  };

  saveBtn.disabled = true;
  savingSpinner.classList.remove('d-none');

  let saveSucceeded = false;
  try {
    if (editingId) {
      await updateDriver(editingId, payload);
      showAlert('更新成功', 'success');
    } else {
      const created = await createDriver(payload);
      if (created?.tempPassword) {
        showAlert(`新增成功。初始密碼：${created.tempPassword}`, 'success', 6000);
      } else {
        showAlert('新增成功', 'success');
      }
    }
    saveSucceeded = true;
  } catch (error) {
    console.error('Save driver failed:', error);
    const codeRaw = error?.code || error?.details?.code || '';
    const code = (typeof codeRaw === 'string') ? codeRaw.replace(/^functions\//, '') : '';
    if (code === 'permission-denied') {
      showAlert('沒有權限：此操作僅限管理者', 'warning', 4000);
    } else if (code === 'unauthenticated') {
      showAlert('請先登入後再試', 'warning', 4000);
    } else if (/unavailable|failed-precondition|deadline-exceeded/i.test(String(error))) {
      showAlert('服務暫時不可用，請確認 Functions 是否啟動', 'warning', 5000);
    } else if (/Email is required/i.test(String(error?.message))) {
      showAlert('Email 為必填，建立帳號需使用 Email');
    } else {
      showAlert('儲存失敗，請稍後再試');
    }
  } finally {
    saveBtn.disabled = false;
    savingSpinner.classList.add('d-none');
  }

  // 儲存成功後，再關閉視窗並刷新表格；就算刷新失敗，也不要覆蓋前面的成功訊息
  if (saveSucceeded) {
    try { modal.hide(); } catch {}
    try {
      await refreshTable();
    } catch (e) {
      console.warn('Refresh after save failed:', e);
      showAlert('已儲存，但更新清單失敗，請重新整理頁面', 'warning', 5000);
    }
  }
});

addBtn.addEventListener('click', () => {
  if (isReadOnly) {
    showAlert('沒有權限：此操作僅限管理者', 'warning');
    return;
  }
  openCreateModal();
});
modalEl.addEventListener('hidden.bs.modal', () => {
  form.reset();
  editingId = null;
  hideAlert();
});

(async function initRole() {
  try {
    const ctx = await getUserContext();
    isReadOnly = (ctx.role !== 'manager');
    if (isReadOnly) {
      addBtn.classList.add('disabled');
      addBtn.setAttribute('aria-disabled', 'true');
      addBtn.title = '此操作僅限管理者';
      showAlert('目前為唯讀模式（需要管理者權限）', 'warning', 3500);
    }
  } catch (e) {
    console.warn('[driver-admin] failed to determine role', e);
  } finally {
    refreshTable();
  }
})();