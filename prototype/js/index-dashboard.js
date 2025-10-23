// index-dashboard.js - 首頁儀表板（接 Firestore 即時資料）
import { db } from '../firebase-init.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

console.log('📊 index-dashboard.js 載入');

// DOM 參照
const elToday = document.getElementById('cardToday');
const elPending = document.getElementById('cardPendingSign');
const elWeekDone = document.getElementById('cardWeekCompleted');
const elUnpaid = document.getElementById('cardUnpaid');
const tbodyToday = document.getElementById('todayJobsTbody');
const recentList = document.getElementById('recentList');

function setText(el, val) { if (el) el.textContent = String(val ?? 0); }

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(d = new Date()) {
  // 以週一為一週起始（回傳 YYYY-MM-DD 字串）
  const day = d.getDay(); // 0-6 (0為週日)
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: ymd(monday), end: ymd(sunday) };
}

function getWeekDateRange(d = new Date()) {
  // 以週一為起點，回傳實際 Date 物件（含時間）供 Timestamp 範圍查詢
  const day = d.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

function getTodayDateRange(d = new Date()) {
  const start = new Date(d);
  start.setHours(0,0,0,0);
  const end = new Date(d);
  end.setHours(23,59,59,999);
  return { start, end };
}

function renderTodayRows(items) {
  if (!tbodyToday) return;
  tbodyToday.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    tr.className = 'text-muted';
    tr.innerHTML = `<td colspan="6" class="text-center py-4">今日沒有簽單</td>`;
    tbodyToday.appendChild(tr);
    return;
  }
  items.forEach(it => {
    const tr = document.createElement('tr');
    const statusBadge = it.signatureStatus === 'completed'
      ? '<span class="badge bg-success">已完成</span>'
      : '<span class="badge bg-warning">待執行</span>';
    tr.innerHTML = `
      <td>${it.localId || it.id || '—'}</td>
      <td>${it.customer || '—'}</td>
      <td>${it.location || '—'}</td>
      <td>${it.startTime || '—'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary">詳細資訊</button>
        </div>
      </td>
    `;
    tbodyToday.appendChild(tr);
  });
}

function renderRecent(list) {
  if (!recentList) return;
  recentList.innerHTML = '';
  if (!list.length) {
    const div = document.createElement('div');
    div.className = 'list-group-item text-muted text-center';
    div.textContent = '目前沒有完成項目';
    recentList.appendChild(div);
    return;
  }
  list.forEach(it => {
    const paid = it.paidAt ? '<small class="text-success"><i class="bi bi-check-circle me-1"></i>已完成收款</small>'
                            : '<small class="text-warning"><i class="bi bi-clock me-1"></i>待收款處理</small>';
    const title = it.work || it.customer || '完成簽單';
    const time = it.endTime || it.date || '';
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'list-group-item list-group-item-action';
    a.innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-center">
        <div>
          <h6 class="mb-1">${title}</h6>
          <p class="mb-1 text-muted">${it.location || ''}</p>
          ${paid}
        </div>
        <small class="text-muted">${time}</small>
      </div>
    `;
    recentList.appendChild(a);
  });
}

(function main() {
  // 預設顯示為 0
  setText(elToday, 0);
  setText(elPending, 0);
  setText(elWeekDone, 0);
  setText(elUnpaid, 0);

  const todayStr = ymd(new Date());
  const { start: weekStartStr, end: weekEndStr } = getWeekRange(new Date());
  const { start: weekStartAt, end: weekEndAt } = getWeekDateRange(new Date());
  const { start: todayStartAt, end: todayEndAt } = getTodayDateRange(new Date());

  const col = collection(db, 'deliveryNotes');

  // 今日新增數 + 清單（以 serverCreatedAt 為準，避免依賴使用者輸入的 date）
  const qToday = query(
    col,
    where('serverCreatedAt', '>=', todayStartAt),
    where('serverCreatedAt', '<=', todayEndAt),
    orderBy('serverCreatedAt', 'asc')
  );
  onSnapshot(qToday, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setText(elToday, items.length);
    // 顯示時仍以開始時間排序較符合人類直覺（若無則使用建立時間）
    items.sort((a, b) => {
      const sa = String(a.startTime || '');
      const sb = String(b.startTime || '');
      if (sa && sb) return sa.localeCompare(sb);
      const ta = a.serverCreatedAt?.toDate ? a.serverCreatedAt.toDate().getTime() : 0;
      const tb = b.serverCreatedAt?.toDate ? b.serverCreatedAt.toDate().getTime() : 0;
      return ta - tb;
    });
    renderTodayRows(items);
  });

  // 待簽核數
  const qPending = query(col, where('signatureStatus', '==', 'pending'));
  onSnapshot(qPending, snap => setText(elPending, snap.size));

  // 未收款數（paidAt 為 null）
  const qUnpaid = query(col, where('paidAt', '==', null));
  onSnapshot(qUnpaid, snap => setText(elUnpaid, snap.size));

  // 本週完成數（穩健版本）：以已完成簽單為基礎，於 client 端依「signedAt」落在本週為主，
  // 若 signedAt 缺漏，則以 date（字串範圍）或 serverCreatedAt（Timestamp）作為備援。
  // 僅使用等值 where，避免複合索引需求。
  const qWeekDoneStable = query(
    col,
    where('signatureStatus', '==', 'completed'),
    orderBy('serverCreatedAt', 'desc'),
    limit(500)
  );
  onSnapshot(qWeekDoneStable, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const inRange = (t) => t && t >= weekStartAt && t <= weekEndAt;
    const toDateObj = (v) => v?.toDate ? v.toDate() : (v instanceof Date ? v : null);
    const count = list.filter(x => {
      // 1) 以 signedAt 為主
      const t1 = toDateObj(x.signedAt);
      if (inRange(t1)) return true;
      // 2) 備援：date 為 YYYY-MM-DD 字串時，用字串比較週範圍
      if (typeof x.date === 'string' && x.date >= weekStartStr && x.date <= weekEndStr) return true;
      // 3) 備援：serverCreatedAt 若落在本週
      const t2 = toDateObj(x.serverCreatedAt);
      if (inRange(t2)) return true;
      return false;
    }).length;
    setText(elWeekDone, count);
  });

  // 最近完成（依 updatedAt 降冪；若無，落回 serverCreatedAt 降冪）
  // 為避免索引問題，直接以 serverCreatedAt 排序
  const qRecent = query(col, where('signatureStatus', '==', 'completed'), orderBy('serverCreatedAt', 'desc'), limit(5));
  onSnapshot(qRecent, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRecent(list);
  });
})();
