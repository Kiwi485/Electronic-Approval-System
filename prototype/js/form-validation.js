// 表單驗證與工時計算模組

const form = document.getElementById('deliveryForm');
const inputsRequired = [...form.querySelectorAll('[data-required]')];
const startTimeEl = document.getElementById('startTime');
const endTimeEl = document.getElementById('endTime');
const crossDayEl = document.getElementById('crossDay');
const totalHoursEl = document.getElementById('totalHours');
const amountDisplayEl = document.getElementById('amount');
const amountRawEl = document.getElementById('amountRaw');
const submitBtn = document.getElementById('submitBtn');
const globalErrorEl = document.getElementById('formGlobalError');
// 簽名已移至獨立簽章頁，這裡不再處理 canvas
let hasSignature = true; // 始終視為可提交（避免舊流程依賴）
wireEvents();
updateSubmitState();

// -------- 時間 / 工時計算 --------
function calcTotalHours(startTime, endTime, isCrossDay = false) {
    if (!isValidTime(startTime) || !isValidTime(endTime)) return null;

    const start = new Date(`1970-01-01T${startTime}:00`);
    let end = new Date(`1970-01-01T${endTime}:00`);

    if (isCrossDay && end <= start) {
        end.setDate(end.getDate() + 1);
    }

    // 若未勾跨日且結束時間小於開始 → 視為錯誤
    if (!isCrossDay && end < start) {
        return 'ERROR_NEGATIVE';
    }

    const diffMs = end - start;
    if (diffMs < 0) return 'ERROR_NEGATIVE';

    const hours = diffMs / (1000 * 60 * 60);
    const rounded = Math.round(hours * 10) / 10;
    return rounded;
}

function updateTotalHours() {
    const start = startTimeEl.value;
    const end = endTimeEl.value;
    if (!start || !end) {
        totalHoursEl.value = '';
        return;
    }
    const result = calcTotalHours(start, end, crossDayEl.checked);
    if (result === 'ERROR_NEGATIVE') {
        totalHoursEl.value = '—';
        showGlobalError('結束時間不可早於開始時間（若為跨日請勾選「跨日」）');
    } else if (result === null) {
        totalHoursEl.value = '—';
    } else {
        clearGlobalError();
        totalHoursEl.value = result.toFixed(1);
    }
    updateSubmitState();
}

// -------- 驗證邏輯 --------
function isValidTime(value) {
    if (!value) return false;
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateField(el) {
    const val = el.value.trim();
    let valid = true;

    if (el === amountDisplayEl) {
        // 金額驗證
        const raw = amountRawEl.value;
        valid = raw !== '' && !isNaN(Number(raw));
    } else if (el.getAttribute('type') === 'time') {
        valid = isValidTime(val);
    } else {
        valid = val.length > 0;
    }

    if (!valid) {
        el.classList.add('is-invalid');
        el.classList.remove('is-valid');
    } else {
        el.classList.remove('is-invalid');
        el.classList.add('is-valid');
    }
    return valid;
}

function validateSignature() { return true; }

function validateTimeRelationship() {
    const s = startTimeEl.value;
    const e = endTimeEl.value;
    if (!s || !e) return false;
    const r = calcTotalHours(s, e, crossDayEl.checked);
    if (r === 'ERROR_NEGATIVE') {
        return false;
    }
    return typeof r === 'number' && r >= 0;
}

function runFullValidation() {
    let ok = true;
    inputsRequired.forEach(el => {
        if (!validateField(el)) ok = false;
    });
    if (!validateSignature()) ok = false;
    if (!validateTimeRelationship()) ok = false;
    if (!ok) {
        showGlobalError('請修正標示為紅框的欄位後再提交。');
    } else {
        clearGlobalError();
    }
    return ok;
}

function updateSubmitState() {
    const basicsOk = inputsRequired.every(el => {
        if (!el.value) return false;
        if (el.type === 'time' && !isValidTime(el.value)) return false;
        if (el === amountDisplayEl && (amountRawEl.value === '' || isNaN(Number(amountRawEl.value)))) return false;
        return true;
    });
    const timeOk = validateTimeRelationship();
    submitBtn.disabled = !(basicsOk && timeOk); // 移除簽名條件
}

// -------- 金額格式化 --------
function formatAmountInput(e) {
    const input = e.target;
    const selectionStart = input.selectionStart;
    const prevLength = input.value.length;
    const rawDigits = input.value.replace(/[^\d]/g, '');
    amountRawEl.value = rawDigits;
    if (rawDigits === '') {
        input.value = '';
        validateField(amountDisplayEl);
        updateSubmitState();
        return;
    }
    const formatted = Number(rawDigits).toLocaleString('zh-TW');
    input.value = formatted;
    // 調整游標：依據差值估算新位置
    const newLength = formatted.length;
    const lengthDiff = newLength - prevLength;
    let cursor = selectionStart + lengthDiff;
    if (cursor < 0) cursor = 0;
    if (cursor > newLength) cursor = newLength;
    requestAnimationFrame(() => {
        input.setSelectionRange(cursor, cursor);
    });
    validateField(amountDisplayEl);
    updateSubmitState();
}

function getSignatureDataURL() { return null; }

// -------- 全域錯誤顯示 --------
function showGlobalError(msg) {
    globalErrorEl.textContent = msg;
    globalErrorEl.classList.remove('d-none');
}

function clearGlobalError() {
    globalErrorEl.textContent = '';
    globalErrorEl.classList.add('d-none');
}

// -------- 綁定事件 --------
function wireEvents() {
    inputsRequired.forEach(el => {
        el.addEventListener('blur', () => {
            validateField(el);
            updateSubmitState();
        });
        el.addEventListener('input', () => {
            if (el.classList.contains('is-invalid')) validateField(el);
            updateSubmitState();
            if (el === startTimeEl || el === endTimeEl) updateTotalHours();
        });
    });

    amountDisplayEl.addEventListener('input', formatAmountInput);
    startTimeEl.addEventListener('change', updateTotalHours);
    endTimeEl.addEventListener('change', updateTotalHours);
    crossDayEl.addEventListener('change', () => {
        updateTotalHours();
    });

    form.addEventListener('reset', () => {
        setTimeout(() => {
            inputsRequired.forEach(el => {
                el.classList.remove('is-invalid', 'is-valid');
            });
            totalHoursEl.value = '';
            clearGlobalError();
            updateSubmitState();
        }, 0);
    });

    // 不在此處綁定 submit，改由 new-delivery.js 主導提交流程
}

// 導出（若其他模組需要）
function buildValidatedPayload() {
    clearGlobalError();
    if (!runFullValidation()) return { ok: false, error: 'VALIDATION_FAILED' };
    const data = {
        customer: form.customer.value.trim(),
        date: form.date.value,
        location: form.location.value.trim(),
        work: form.work.value.trim(),
        startTime: startTimeEl.value,
        endTime: endTimeEl.value,
        crossDay: crossDayEl.checked,
        totalHours: totalHoursEl.value ? Number(totalHoursEl.value) : null,
        amount: Number(amountRawEl.value),
        machine: form.machine ? form.machine.value.trim() : '',
        vehicleNumber: form.vehicleNumber ? form.vehicleNumber.value.trim() : '',
        driverName: form.driverName ? form.driverName.value.trim() : '',
        remark: form.remark ? form.remark.value.trim() : '',
        signatureDataUrl: null,
        signatureStatus: 'pending'
    };
    return { ok: true, data };
}

export { calcTotalHours, buildValidatedPayload, getSignatureDataURL };