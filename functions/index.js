'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function assertManager(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('permission-denied', 'Authentication is required.');
  }
  const role = context.auth.token?.role;
  if (role !== 'manager' && role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Manager privilege is required.');
  }
  return context.auth.uid;
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmail(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (err) {
      return null;
    }
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

async function mapDriverDoc(docSnapshotOrRef) {
  const snapshot = typeof docSnapshotOrRef.get === 'function' ? await docSnapshotOrRef.get() : docSnapshotOrRef;
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'Driver document not found.');
  }
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    uid: data.uid || snapshot.id,
    displayName: data.displayName || '',
    role: data.role || 'driver',
    isActive: data.isActive !== false,
    email: data.email ?? null,
    phone: data.phone ?? null,
    licenseNo: data.licenseNo ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

async function ensureDriverClaims(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    const claims = user.customClaims || {};
    if (claims.role === 'driver') return;
    await admin.auth().setCustomUserClaims(uid, { ...claims, role: 'driver' });
  } catch (err) {
    handleAuthError(err, 'setCustomUserClaims');
  }
}

function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let base = '';
  for (let i = 0; i < 10; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    base += alphabet.charAt(index);
  }
  return `${base}!1`;
}

async function applyAuthSync(uid, fields) {
  let record;
  try {
    record = await admin.auth().getUser(uid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      if (!fields.email) {
        throw new functions.https.HttpsError('failed-precondition', 'Email is required to establish authentication.');
      }
      try {
        record = await admin.auth().createUser({
          uid,
          email: fields.email,
          displayName: fields.displayName || fields.uid || uid,
          disabled: fields.isActive === false
        });
      } catch (createErr) {
        handleAuthError(createErr, 'createUser');
      }
    } else {
      handleAuthError(err, 'getUser');
    }
  }

  const updates = {};
  if (fields.email && record.email !== fields.email) updates.email = fields.email;
  if (fields.displayName && record.displayName !== fields.displayName) updates.displayName = fields.displayName;
  if (typeof fields.isActive === 'boolean') {
    const shouldDisable = !fields.isActive;
    if (record.disabled !== shouldDisable) updates.disabled = shouldDisable;
  }

  if (Object.keys(updates).length > 0) {
    try {
      record = await admin.auth().updateUser(uid, updates);
    } catch (updateErr) {
      handleAuthError(updateErr, 'updateUser');
    }
  }

  await ensureDriverClaims(uid);
  return record;
}

function handleAuthError(err, stage = 'auth') {
  const code = err?.code || '';
  if (code.startsWith('auth/')) {
    const message = `${stage} failed (${code})`;
    console.error('[driver-account] auth error', { stage, code, message: err?.message });
    throw new functions.https.HttpsError('failed-precondition', message, { code, message: err?.message });
  }
  throw err;
}

exports.createDriverAccount = functions.region('asia-east1').https.onCall(async (data, context) => {
  assertManager(context);

  const displayName = normalizeString(data?.displayName);
  if (!displayName) {
    throw new functions.https.HttpsError('invalid-argument', 'displayName is required.');
  }

  const email = normalizeEmail(data?.email);
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  const phone = normalizeString(data?.phone);
  const licenseNo = normalizeString(data?.licenseNo);
  const isActive = data?.isActive !== false;

  let existing;
  try {
    existing = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  let tempPassword = null;
  let targetUid;

  if (existing) {
    targetUid = existing.uid;
    await admin.auth().updateUser(existing.uid, {
      displayName,
      disabled: !isActive
    });
  } else {
    tempPassword = generateTempPassword();
    const created = await admin.auth().createUser({
      email,
      displayName,
      password: tempPassword,
      disabled: !isActive
    });
    targetUid = created.uid;
  }

  await ensureDriverClaims(targetUid);

  const now = FieldValue.serverTimestamp();
  const docRef = db.collection('users').doc(targetUid);
  const payload = {
    uid: targetUid,
    displayName,
    email,
    phone: phone ?? null,
    licenseNo: licenseNo ?? null,
    role: 'driver',
    isActive,
    updatedAt: now
  };

  const snap = await docRef.get();
  if (!snap.exists) {
    payload.createdAt = now;
  }

  await docRef.set(payload, { merge: true });

  const driver = await mapDriverDoc(docRef);
  if (tempPassword) {
    driver.tempPassword = tempPassword;
  }

  return { driver };
});

exports.updateDriverAccount = functions.region('asia-east1').https.onCall(async (data, context) => {
  assertManager(context);

  const targetId = normalizeString(data?.id) || normalizeString(data?.uid);
  if (!targetId) {
    throw new functions.https.HttpsError('invalid-argument', 'Driver id is required.');
  }

  const docRef = db.collection('users').doc(targetId);
  const currentSnap = await docRef.get();
  if (!currentSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Driver document does not exist.');
  }

  const currentData = currentSnap.data() || {};
  const now = FieldValue.serverTimestamp();
  const updates = { updatedAt: now };

  if (data.displayName !== undefined) {
    updates.displayName = normalizeString(data.displayName) || '';
  }
  if (data.email !== undefined) {
    updates.email = normalizeEmail(data.email);
  }
  if (data.phone !== undefined) {
    updates.phone = normalizeString(data.phone);
  }
  if (data.licenseNo !== undefined) {
    updates.licenseNo = normalizeString(data.licenseNo);
  }
  if (data.isActive !== undefined) {
    updates.isActive = Boolean(data.isActive);
  }

  await docRef.set(updates, { merge: true });

  const effectiveData = {
    uid: currentData.uid || targetId,
    displayName: updates.displayName ?? currentData.displayName ?? '',
    email: updates.email ?? currentData.email ?? null,
    phone: updates.phone ?? currentData.phone ?? null,
    licenseNo: updates.licenseNo ?? currentData.licenseNo ?? null,
    isActive: updates.isActive ?? currentData.isActive !== false
  };

  try {
    await applyAuthSync(effectiveData.uid, effectiveData);
  } catch (err) {
    console.error('[updateDriverAccount] applyAuthSync failed', { uid: effectiveData.uid, code: err?.code, message: err?.message });
    throw err;
  }

  const driver = await mapDriverDoc(docRef);
  return { driver };
});

exports.deleteDriverAccount = functions.region('asia-east1').https.onCall(async (data, context) => {
  assertManager(context);

  const targetId = normalizeString(data?.id) || normalizeString(data?.uid);
  if (!targetId) {
    throw new functions.https.HttpsError('invalid-argument', 'Driver id is required.');
  }

  const docRef = db.collection('users').doc(targetId);
  const snap = await docRef.get();
  const docData = snap.exists ? snap.data() : null;

  await docRef.delete();

  const uid = docData?.uid || targetId;
  if (uid) {
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        handleAuthError(err, 'deleteUser');
      }
    }
  }

  return { success: true };
});
