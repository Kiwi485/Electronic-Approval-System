// session-context.js - share authenticated user profile & role across modules
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js';
import { db } from '../firebase-init.js';
import { waitAuthReady } from './auth.js';

let cachedProfile = null;
let profilePromise = null;
let lastRole = null;

const DEFAULT_ROLE = 'driver';

function normalizeRole(role) {
  if (role === 'manager' || role === 'admin') return 'manager';
  if (typeof role === 'string' && role.trim().length > 0) return role;
  return DEFAULT_ROLE;
}

function applyRoleToDocument(role) {
  try {
    const root = document?.documentElement;
    if (root) root.setAttribute('data-user-role', role || 'unknown');
  } catch (err) {
    console.warn('[session-context] failed to set role on document', err);
  }
}

function emitRole(role, profile) {
  if (role && role === lastRole) return;
  lastRole = role;
  applyRoleToDocument(role);
  try {
    document.dispatchEvent(new CustomEvent('user-role-determined', { detail: { role, profile } }));
  } catch (err) {
    console.warn('[session-context] failed to dispatch role event', err);
  }
}

async function loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('[session-context] loadProfile error', err);
  }
  return null;
}

export async function waitForProfile(options = {}) {
  const { forceRefresh = false } = options;
  const user = await waitAuthReady();
  if (!user) {
    cachedProfile = null;
    profilePromise = null;
    emitRole('anonymous', null);
    return null;
  }
  if (!profilePromise || forceRefresh) {
    profilePromise = loadProfile(user.uid).then((profile) => {
      cachedProfile = profile;
      const role = normalizeRole(profile?.role);
      emitRole(role, profile);
      return profile;
    });
  }
  return profilePromise;
}

export async function getUserContext(options = {}) {
  const user = await waitAuthReady();
  if (!user) return { uid: null, role: null, user: null, profile: null };
  const profile = (cachedProfile && !options.forceRefresh) ? cachedProfile : await waitForProfile(options);
  const role = normalizeRole(profile?.role);
  return { uid: user.uid, user, profile, role };
}

export function getCachedProfile() {
  return cachedProfile;
}

export function getCachedRole() {
  return lastRole;
}

export function onUserRoleReady(handler) {
  if (typeof handler !== 'function') return () => {};
  const listener = (event) => handler(event.detail || { role: lastRole, profile: cachedProfile });
  document.addEventListener('user-role-determined', listener);
  if (lastRole) {
    try {
      handler({ role: lastRole, profile: cachedProfile });
    } catch {}
  }
  return () => document.removeEventListener('user-role-determined', listener);
}

waitAuthReady().then(async (user) => {
  if (!user) {
    emitRole('anonymous', null);
    return;
  }
  try {
    await waitForProfile();
  } catch (err) {
    console.warn('[session-context] initial waitForProfile error', err);
    emitRole(DEFAULT_ROLE, null);
  }
}).catch(() => {
  emitRole('anonymous', null);
});
