/* =============================================
   auth.js – Authentication & Role-Based Access
   NEU Library Visitor Management System v2
   =============================================
   Uses Firebase Auth for Google OAuth and
   Email/Password. Firestore stores profiles.
   ============================================= */

import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getUserByEmail, getUserBySchoolId, getUserById,
  createUserProfile, switchActiveRole,
  setSession, clearSession, waitForAuthAndProfile,
} from './storage.js';

const NEU_DOMAIN_AUTH = 'neu.edu.ph';

function isInstitutionalEmail(email) {
  return (email || '').trim().toLowerCase().endsWith('@' + NEU_DOMAIN_AUTH);
}

/* ══════════════════════════════════════════
   EMAIL / PASSWORD LOGIN
══════════════════════════════════════════ */
async function attemptLogin(identifier, password) {
  const trimmed = identifier.trim();

  // Determine email
  let email;
  if (trimmed.includes('@')) {
    if (!isInstitutionalEmail(trimmed))
      return { ok: false, error: 'Only NEU institutional emails (@neu.edu.ph) are allowed.' };
    email = trimmed.toLowerCase();
  } else {
    // School ID login — look up email first
    const user = await getUserBySchoolId(trimmed);
    if (!user) return { ok: false, error: 'No account found with that School ID.' };
    email = user.email;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserById(cred.user.uid);
    if (!profile) return { ok: false, error: 'Account profile not found. Please re-register.' };
    if (profile.isBlocked) {
      await signOut(auth);
      return { ok: false, error: 'Your account has been blocked. Contact the library administrator.' };
    }
    setSession(profile);
    return { ok: true, user: profile };
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
      return { ok: false, error: 'Incorrect email/ID or password.' };
    if (err.code === 'auth/too-many-requests')
      return { ok: false, error: 'Too many failed attempts. Try again later.' };
    return { ok: false, error: err.message };
  }
}

/* ══════════════════════════════════════════
   EMAIL / PASSWORD REGISTER
══════════════════════════════════════════ */
async function attemptRegister(data) {
  const emailNorm = data.email.trim().toLowerCase();
  if (!isInstitutionalEmail(emailNorm))
    return { ok: false, error: 'Email must be an NEU institutional address (@neu.edu.ph).' };

  try {
    const cred   = await createUserWithEmailAndPassword(auth, emailNorm, data.password);
    const result = await createUserProfile(cred.user.uid, { ...data, email: emailNorm, googleAuth: false });
    if (!result.ok) {
      // Profile creation failed — delete the orphan auth account
      await cred.user.delete();
      return result;
    }
    setSession(result.user);
    return { ok: true, user: result.user };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use')
      return { ok: false, error: 'Email already registered. Please sign in.' };
    if (err.code === 'auth/weak-password')
      return { ok: false, error: 'Password must be at least 6 characters.' };
    return { ok: false, error: err.message };
  }
}

/* ══════════════════════════════════════════
   GOOGLE OAUTH  (NEU domain enforced)
══════════════════════════════════════════ */
async function attemptGoogleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: NEU_DOMAIN_AUTH,       // hint to show only @neu.edu.ph accounts
    prompt: 'select_account'   // always show account picker
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;
    const email  = fbUser.email || '';

    if (!isInstitutionalEmail(email)) {
      await signOut(auth);
      return { ok: false, error: 'Only @neu.edu.ph Google accounts are allowed.' };
    }

    // Check if profile already exists
    const profile = await getUserById(fbUser.uid);
    if (profile) {
      if (profile.isBlocked) {
        await signOut(auth);
        return { ok: false, error: 'Your account has been blocked. Contact the library administrator.' };
      }
      setSession(profile);
      return { ok: true, user: profile };
    }

    // New Google user — needs profile completion
    // Parse name parts from Google display name
    const displayName = fbUser.displayName || '';
    const nameParts   = displayName.trim().split(' ');
    const firstName   = nameParts[0] || '';
    const lastName    = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    return {
      ok: false,
      needsProfile: true,
      uid:       fbUser.uid,
      email,
      firstName,
      lastName,
    };
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')
      return { ok: false, error: null }; // silent cancel
    if (err.code === 'auth/popup-blocked')
      return { ok: false, error: 'Popup was blocked. Please allow popups for this site.' };
    return { ok: false, error: err.message };
  }
}

async function attemptGoogleRegisterProfile(uid, data) {
  const emailNorm = data.email.trim().toLowerCase();
  if (!isInstitutionalEmail(emailNorm))
    return { ok: false, error: 'Only @neu.edu.ph Google accounts are allowed.' };

  const result = await createUserProfile(uid, { ...data, email: emailNorm, googleAuth: true });
  if (!result.ok) return result;
  setSession(result.user);
  return { ok: true, user: result.user };
}

/* ══════════════════════════════════════════
   GUARDS  (call at top of each protected page)
══════════════════════════════════════════ */
async function requireAuth() {
  const user = await waitForAuthAndProfile();
  if (!user) { window.location.href = 'index.html'; return null; }
  return user;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  if (user.activeRole !== 'admin') { window.location.href = 'checkin.html'; return null; }
  return user;
}

/* ══════════════════════════════════════════
   ROLE SWITCHING
══════════════════════════════════════════ */
function canSwitchToAdmin(user) {
  return Array.isArray(user.roles) && user.roles.includes('admin');
}

async function doSwitchRole(user, targetRole) {
  if (!Array.isArray(user.roles) || !user.roles.includes(targetRole)) return false;
  const ok = await switchActiveRole(user.id, targetRole);
  if (!ok) return false;
  if (targetRole === 'admin') window.location.href = 'dashboard.html';
  else                        window.location.href = 'checkin.html';
  return true;
}

/* ══════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════ */
async function handleLogout() {
  clearSession();
  await signOut(auth);
  window.location.href = 'index.html';
}

/* ── Helpers ── */
function fullName(user) {
  if (!user) return '';
  const mi = user.mi ? ` ${user.mi}` : '';
  return `${user.firstName}${mi} ${user.lastName}`;
}

function userTypeLabel(t) {
  if (t === 'faculty') return 'Faculty / Teacher';
  if (t === 'staff')   return 'Staff / Employee';
  return 'Student';
}

export {
  isInstitutionalEmail,
  attemptLogin, attemptRegister,
  attemptGoogleLogin, attemptGoogleRegisterProfile,
  requireAuth, requireAdmin,
  canSwitchToAdmin, doSwitchRole,
  handleLogout, fullName, userTypeLabel,
};