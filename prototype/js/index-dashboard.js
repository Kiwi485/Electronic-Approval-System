// index-dashboard.js — 首頁儀表（直接接 Firestore，與 Mock 無關）
import { db } from '../firebase-init.js';
import {
	collection, getDocs, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';

console.info('[Dashboard] index-dashboard.js loaded');

// ---- 小工具 ----
function pad(n){ return String(n).padStart(2,'0'); }
function localDateStr(d = new Date()) {
	// 以本地時區產生 YYYY-MM-DD（避免 ISO UTC 造成日期倒退）
	return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function todayStr() { return localDateStr(new Date()); }

function getWeekRange(date = new Date()) {
	// 以週一為一週開始
	const d = new Date(date);
	const day = d.getDay() || 7; // 週日=0 -> 7
	const start = new Date(d);
	start.setDate(d.getDate() - (day - 1));
	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	const toStr = (x) => localDateStr(x);
	return { start, end, startStr: toStr(start), endStr: toStr(end) };
}

function text(el, value) { if (el) el.textContent = String(value); }
function safeNum(x) { return Number.isFinite(x) ? x : 0; }
function formatDateTime(val) {
	if (!val) return '';
	let d = val;
	if (typeof val?.toDate === 'function') d = val.toDate();
	if (!(d instanceof Date)) {
		const t = new Date(val);
		if (!isNaN(t)) d = t; else return String(val).slice(0, 16);
	}
	return `${localDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- DOM 目標（不改 HTML，採結構選擇）----
const cardNumbers = Array.from(document.querySelectorAll('.card-dashboard .card-body .display-4'));
// 預期順序：0 今日簽單；1 待簽核；2 本週完成；3 未收款
const todayTableBody = document.querySelector('.card.mb-4 tbody'); // 今日簽單列表（第一個列表卡）
const recentList = document.querySelector('.list-group'); // 最近完成（唯一 list-group）

async function fetchTodayDocs() {
	const q = query(collection(db, 'deliveryNotes'), where('date', '==', todayStr()));
	const snap = await getDocs(q);
	return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchPendingDocs() {
	const q = query(collection(db, 'deliveryNotes'), where('signatureStatus', '==', 'pending'));
	const snap = await getDocs(q);
	return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchCompletedDocsForWeek() {
	// 避免複合索引，先用 signatureStatus = completed 取回，再以 client 過濾本週範圍
	const q = query(collection(db, 'deliveryNotes'), where('signatureStatus', '==', 'completed'));
	const snap = await getDocs(q);
	const { startStr, endStr } = getWeekRange();
	const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
	return list.filter(x => {
		const date = x.date;
		return typeof date === 'string' && date >= startStr && date <= endStr;
	});
}

async function fetchUnpaidDocs() {
	// 需要新單據預設 paidAt: null（已由 new-delivery.js 保障）
	const q = query(collection(db, 'deliveryNotes'), where('paidAt', '==', null));
	const snap = await getDocs(q);
	return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchRecentCompleted(limitN = 5) {
	// 以 signedAt 排序（簽章完成時間），再於 client 過濾 completed；抓 20 筆後裁切
	const q = query(collection(db, 'deliveryNotes'), orderBy('signedAt', 'desc'), limit(20));
	const snap = await getDocs(q);
	const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
		.filter(x => (x.signatureStatus || 'pending') === 'completed')
		.slice(0, limitN);
	return rows;
}

function renderTodayTable(rows) {
	if (!todayTableBody) return;
	if (!rows.length) {
		todayTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">今日無簽單</td></tr>`;
		return;
	}
	const html = rows.map(r => {
		const status = (r.signatureStatus || 'pending') === 'completed'
			? '<span class="badge bg-success">已簽章</span>'
			: '<span class="badge bg-warning text-dark">待簽章</span>';
		const time = r.startTime || '';
		const location = r.location || (r.origin && r.destination ? `${r.origin} → ${r.destination}` : (r.origin || r.destination || '—'));
		return `
			<tr>
				<td>${r.id.slice(-8)}</td>
				<td>${r.customer || '—'}</td>
				<td>${location}</td>
				<td>${time}</td>
				<td>${status}</td>
				<td>
					<div class="btn-group">
						<a class="btn btn-sm btn-outline-primary" href="sign-delivery.html?id=${encodeURIComponent(r.id)}">簽章</a>
						<a class="btn btn-sm btn-outline-secondary" href="history.html?focus=${encodeURIComponent(r.id)}">詳細</a>
					</div>
				</td>
			</tr>`;
	}).join('');
	todayTableBody.innerHTML = html;
}

function renderRecentCompleted(rows) {
	if (!recentList) return;
	if (!rows.length) {
		recentList.innerHTML = '<div class="text-muted small p-3">目前沒有最近完成的簽單</div>';
		return;
	}
	const html = rows.map(r => {
		const title = r.work || r.item || (r.customer ? `${r.customer} 簽單` : '簽單');
		const desc = r.location || (r.origin && r.destination ? `${r.origin} → ${r.destination}` : '') || '—';
		const when = r.signedAt || r.updatedAt || r.createdAt || '';
		return `
			<a class="list-group-item list-group-item-action" href="sign-delivery.html?id=${encodeURIComponent(r.id)}">
				<div class="d-flex w-100 justify-content-between align-items-center">
					<div>
						<h6 class="mb-1">${title}</h6>
						<p class="mb-1 text-muted">${desc}</p>
						<small class="text-success"><i class="bi bi-check-circle me-1"></i>已完成簽核</small>
					</div>
					<small class="text-muted">${formatDateTime(when)}</small>
				</div>
			</a>`;
	}).join('');
	recentList.innerHTML = html;
}

async function refresh() {
	try {
		const [todayRows, pendingRows, weekCompletedRows, unpaidRows, recentRows] = await Promise.all([
			fetchTodayDocs(),
			fetchPendingDocs(),
			fetchCompletedDocsForWeek(),
			fetchUnpaidDocs(),
			fetchRecentCompleted(5)
		]);

		// 卡片數字
		if (cardNumbers[0]) text(cardNumbers[0], safeNum(todayRows.length));
		if (cardNumbers[1]) text(cardNumbers[1], safeNum(pendingRows.length));
		if (cardNumbers[2]) text(cardNumbers[2], safeNum(weekCompletedRows.length));
		if (cardNumbers[3]) text(cardNumbers[3], safeNum(unpaidRows.length));

		// 列表
		renderTodayTable(todayRows);
		renderRecentCompleted(recentRows);
	} catch (err) {
		console.warn('[Dashboard] refresh failed:', err);
		// degrade gracefully
		if (cardNumbers[0]) text(cardNumbers[0], '0');
		if (cardNumbers[1]) text(cardNumbers[1], '0');
		if (cardNumbers[2]) text(cardNumbers[2], '0');
		if (cardNumbers[3]) text(cardNumbers[3], '0');
		if (todayTableBody) todayTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">無法載入資料</td></tr>`;
		if (recentList) recentList.innerHTML = '<div class="text-muted small p-3">無法載入資料</div>';
	}
}

// 延遲到 DOM 與 auth 皆可用（auth-guard 會在驗證後解鎖頁面顯示）
document.addEventListener('DOMContentLoaded', refresh);

// 可選：每隔一段時間刷新
setInterval(() => { try { refresh(); } catch {} }, 60 * 1000);

