#!/usr/bin/env node
/**
 * Dev Seeder (firebase-admin)
 * - 從靜態種子資料建立 Firebase Authentication 使用者
 * - 同步在 Firestore 建立/更新 users/{uid} 文件
 * - 預設不覆蓋既有 role（除非加 --force）
 *
 * 使用方式：
 *   node dev-seed-users.js           # 不覆蓋 role
 *   node dev-seed-users.js --force   # 覆蓋 role 及其他欄位
 *
 * 環境需求：
 *   npm install firebase-admin
 *   若使用 emulator，請設定 FIRESTORE_EMULATOR_HOST 與 FIREBASE_AUTH_EMULATOR_HOST
 *   若使用 service account，請設定 GOOGLE_APPLICATION_CREDENTIALS
 */

const admin = require('firebase-admin');

function loadSeedData() {
	// 這裡的資料和 prototype/js/dev-seed.js 中的 users 種子保持同步
	// 如需調整請在兩邊一併更新或改從外部 JSON 載入
	return [
		{ uid: 'u-manager', email: 'manager@example.test', displayName: '系統經理', role: 'manager', isActive: true, password: 'Test1234!' },
		{ uid: 'u-wang', email: 'wang@example.test', displayName: '王小明', role: 'driver', isActive: true, password: 'Test1234!' },
		{ uid: 'u-lee', email: 'lee@example.test', displayName: '李阿華', role: 'driver', isActive: true, password: 'Test1234!' },
		{ uid: 'u-retire', email: 'retire@example.test', displayName: '退休師傅', role: 'driver', isActive: false, password: 'Test1234!' }
	];
}

async function initAdmin() {
	if (admin.apps.length) return admin.app();

	// 記錄目前環境參數，便於排錯
	console.info('[Env]', {
		FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '',
		FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '',
		GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || ''
	});

	const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

	if (useEmulator) {
		const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'local-project';
		admin.initializeApp({ projectId });
		console.info(`[Seeder] Initialized firebase-admin in emulator mode (projectId=${projectId})`);
	} else {
		admin.initializeApp({ credential: admin.credential.applicationDefault() });
		console.info('[Seeder] Initialized firebase-admin using application default credentials');
	}

	return admin.app();
}

async function ensureAuthUser(auth, seed, force) {
	try {
		const user = await auth.getUser(seed.uid);
		// 若 email 變更，視需求更新（force 時更新 email/displayName）
		const update = {};
		if (force && seed.email && user.email !== seed.email) update.email = seed.email;
		if (force && seed.displayName && user.displayName !== seed.displayName) update.displayName = seed.displayName;
		if (force && typeof seed.isActive === 'boolean' && user.disabled === seed.isActive) {
			update.disabled = !seed.isActive;
		}
		if (Object.keys(update).length > 0) {
			await auth.updateUser(seed.uid, update);
			console.info(`[Auth] updated uid=${seed.uid} ${JSON.stringify(update)}`);
		} else {
			console.info(`[Auth] exists uid=${seed.uid}`);
		}
		return user;
	} catch (err) {
		if (err.code === 'auth/user-not-found') {
			const user = await auth.createUser({
				uid: seed.uid,
				email: seed.email,
				password: seed.password,
				displayName: seed.displayName,
				disabled: seed.isActive === false
			});
			console.info(`[Auth] created uid=${seed.uid} email=${seed.email}`);
			return user;
		}
		throw err;
	}
}

async function setCustomClaims(auth, seed, force) {
	if (!seed.role) return;
	try {
		const current = await auth.getUser(seed.uid);
		const claims = current.customClaims || {};
		if (!force && claims.role === seed.role) {
			return; // 不覆蓋既有 role
		}
		await auth.setCustomUserClaims(seed.uid, { ...claims, role: seed.role });
		console.info(`[Auth] setCustomUserClaims uid=${seed.uid} role=${seed.role}`);
	} catch (err) {
		console.warn(`[Auth] setCustomUserClaims failed uid=${seed.uid}: ${err.message}`);
	}
}

async function ensureUserDoc(db, seed, force) {
	const ref = db.collection('users').doc(seed.uid);
	const snap = await ref.get();
	if (snap.exists && !force) {
		const data = snap.data() || {};
		if (data.role) {
			console.info(`[Firestore] skip users/${seed.uid} role=${data.role}`);
			return;
		}
	}

	const now = admin.firestore.FieldValue.serverTimestamp();
	const payload = {
		uid: seed.uid,
		email: seed.email,
		displayName: seed.displayName,
		role: seed.role || 'user',
		isActive: seed.isActive !== false,
		updatedAt: now
	};
	if (!snap.exists) payload.createdAt = now;

	await ref.set(payload, { merge: true });
	console.info(`[Firestore] set users/${seed.uid} role=${payload.role}`);
}

async function main() {
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const skipClaims = args.includes('--no-claims');

	await initAdmin();
	const auth = admin.auth();
	const db = admin.firestore();

	const seeds = loadSeedData();
	console.info(`[Seeder] start force=${force} seeds=${seeds.length}`);

	for (const seed of seeds) {
		try {
			await ensureAuthUser(auth, seed, force);
			if (!skipClaims) await setCustomClaims(auth, seed, force);
			await ensureUserDoc(db, seed, force);
		} catch (err) {
			console.error(`[Seeder] error uid=${seed.uid}:`, err.message || err);
		}
	}

	// 額外列出 emulator 中的使用者與 Firestore users 文件數，協助對齊
	try {
		const users = await auth.listUsers(1000);
		console.info(`[Verify] Auth users count = ${users.users.length}`);
		console.info('[Verify] Auth users (uid,email)=', users.users.map(u => `${u.uid}:${u.email}`));
	} catch (e) {
		console.warn('[Verify] listUsers failed:', e.message);
	}
	try {
		const snap = await db.collection('users').get();
		console.info(`[Verify] Firestore users docs = ${snap.size}`);
		console.info('[Verify] Firestore user ids =', snap.docs.map(d => d.id));
	} catch (e) {
		console.warn('[Verify] read Firestore users failed:', e.message);
	}

	console.info('[Seeder] done. 請在 Emulator UI 或使用 list-users.js 檢查 Authentication 與 Firestore users。');
	process.exit(0);
}

main().catch((err) => {
	console.error('[Seeder] Unhandled error:', err);
	process.exit(1);
});