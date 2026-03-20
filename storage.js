/* =============================================
   storage.js – Firestore Data Layer
   NEU Library Visitor Management System v2
   =============================================
   Replaces localStorage with Firebase Firestore.
   All async functions return Promises.
   ============================================= */

import { auth, db } from './firebase.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── CONSTANTS ── */
const NEU_DOMAIN = 'neu.edu.ph';

const HARDCODED_ADMINS = [
  'admin@neu.edu.ph',
  'jcesperanza@neu.edu.ph',
];

function isHardcodedAdmin(email) {
  return HARDCODED_ADMINS.includes((email || '').trim().toLowerCase());
}

function isValidSchoolId(id) {
  return /^\d{2}-\d{5}-\d{3}$/.test((id || '').trim());
}

/* ══════════════════════════════════════════
   USERS  (collection: "users", doc id = uid)
══════════════════════════════════════════ */

async function getUserById(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getUserByEmail(email) {
  const q    = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function getUserBySchoolId(schoolId) {
  const q    = query(collection(db, 'users'), where('schoolId', '==', schoolId.trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function getUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createUserProfile(uid, data) {
  const emailNorm = data.email.trim().toLowerCase();
  const sidTrim   = (data.schoolId || '').trim();

  try {
    const existing = await getUserByEmail(emailNorm);
    if (existing) return { ok: false, error: 'Email already registered.' };
  } catch (e) {
    // permissions error on read - proceed, setDoc will handle it
  }

  if (sidTrim && sidTrim !== 'ADMIN' && !isValidSchoolId(sidTrim)) {
    return { ok: false, error: 'School ID format must be yy-xxxxx-xxx (e.g. 24-13384-401).' };
  }
  if (sidTrim && sidTrim !== 'ADMIN') {
    const sidExists = await getUserBySchoolId(sidTrim);
    if (sidExists) return { ok: false, error: 'School ID already registered.' };
  }

  const isAdmin = isHardcodedAdmin(emailNorm);
  const profile = {
    schoolId:   sidTrim,
    firstName:  data.firstName.trim(),
    mi:         (data.mi || '').trim(),
    lastName:   data.lastName.trim(),
    email:      emailNorm,
    college:    data.college || '',
    program:    (data.program || '').trim(),
    userType:   data.userType || 'student',
    roles:      isAdmin ? ['visitor', 'admin'] : ['visitor'],
    activeRole: 'visitor',
    isBlocked:  false,
    createdAt:  new Date().toISOString(),
    googleAuth: data.googleAuth || false,
  };

  await setDoc(doc(db, 'users', uid), profile);
  return { ok: true, user: { id: uid, ...profile } };
}

async function toggleBlockUser(userId) {
  const userRef = doc(db, 'users', userId);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) return false;
  const newVal = !snap.data().isBlocked;
  await updateDoc(userRef, { isBlocked: newVal });
  return newVal;
}

async function switchActiveRole(userId, newRole) {
  const userRef = doc(db, 'users', userId);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) return false;
  const roles = snap.data().roles || [];
  if (!roles.includes(newRole)) return false;
  await updateDoc(userRef, { activeRole: newRole });
  const updated = { id: userId, ...snap.data(), activeRole: newRole };
  setSession(updated);
  return true;
}

/* ══════════════════════════════════════════
   VISITS  (collection: "visits")
══════════════════════════════════════════ */

async function createVisit(userId, data) {
  let userType = 'student';
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) userType = userSnap.data().userType || 'student';
  } catch (e) {
    // fallback to student if read fails
  }
  const visit = {
    userId,
    purpose:   data.purpose,
    college:   data.college,
    userType,
    timestamp: new Date().toISOString(),
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, 'visits'), visit);
  return { id: ref.id, ...visit };
}

async function getVisits() {
  const q    = query(collection(db, 'visits'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getVisitsByRange(startDate, endDate) {
  const start = Timestamp.fromDate(new Date(startDate));
  const end   = new Date(endDate); end.setHours(23, 59, 59, 999);
  const endTs = Timestamp.fromDate(end);
  const q     = query(
    collection(db, 'visits'),
    where('createdAt', '>=', start),
    where('createdAt', '<=', endTs),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getVisitsToday() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return getVisitsByRange(start.toISOString(), start.toISOString());
}

async function getVisitsThisWeek() {
  const now = new Date();
  const s   = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0,0,0,0);
  return getVisitsByRange(s.toISOString(), now.toISOString());
}

async function getVisitsThisMonth() {
  const now = new Date();
  const s   = new Date(now.getFullYear(), now.getMonth(), 1);
  return getVisitsByRange(s.toISOString(), now.toISOString());
}

/* ── Grouping helpers ── */
function groupVisitsByCollege(visits) {
  const g = {};
  visits.forEach(v => { const k = v.college || 'Unknown'; g[k] = (g[k]||0)+1; });
  return g;
}
function groupVisitsByPurpose(visits) {
  const g = {};
  visits.forEach(v => { (v.purpose||'Unknown').split(', ').forEach(p=>{ g[p]=(g[p]||0)+1; }); });
  return g;
}
function groupVisitsByUserType(visits) {
  const g = { student:0, faculty:0, staff:0 };
  visits.forEach(v => { const t=v.userType||'student'; g[t]=(g[t]||0)+1; });
  return g;
}
function getDailyTrendFromVisits(visits, days=7) {
  const labels=[], counts=[];
  for (let i=days-1; i>=0; i--) {
    const d=new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const e=new Date(d); e.setHours(23,59,59,999);
    labels.push(d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}));
    counts.push(visits.filter(v=>{ const vd=new Date(v.timestamp); return vd>=d&&vd<=e; }).length);
  }
  return { labels, counts };
}

/* ══════════════════════════════════════════
   SESSION  (sessionStorage cache)
══════════════════════════════════════════ */
const SESSION_KEY = 'neu_session';
function setSession(user)  { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function getSession()      { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession()    { sessionStorage.removeItem(SESSION_KEY); }

function waitForAuthAndProfile() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      unsub();
      if (!fbUser) { resolve(null); return; }
      const profile = await getUserById(fbUser.uid);
      if (!profile || profile.isBlocked) { await signOut(auth); resolve(null); return; }
      setSession(profile);
      resolve(profile);
    });
  });
}

export {
  isHardcodedAdmin, isValidSchoolId,
  getUserById, getUserByEmail, getUserBySchoolId, getUsers,
  createUserProfile, toggleBlockUser, switchActiveRole,
  createVisit, getVisits, getVisitsByRange,
  getVisitsToday, getVisitsThisWeek, getVisitsThisMonth,
  groupVisitsByCollege, groupVisitsByPurpose, groupVisitsByUserType,
  getDailyTrendFromVisits,
  setSession, getSession, clearSession, waitForAuthAndProfile,
};