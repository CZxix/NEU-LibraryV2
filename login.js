/* =============================================
   login.js – Login / Register page logic
   NEU Library Visitor Management System v2
   ============================================= */

import {
  isInstitutionalEmail,
  attemptLogin, attemptRegister,
  attemptGoogleLogin, attemptGoogleRegisterProfile,
  canSwitchToAdmin, handleLogout,
  fullName,
} from './auth.js';
import {
  getVisitsToday, getVisitsThisWeek,
  getUserByEmail, switchActiveRole, setSession, isValidSchoolId,
} from './storage.js';
import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let googleModalMode  = 'login'; // 'login' | 'register' | 'google-new'
let pendingGoogleUID = null;    // Firebase UID for Google new-user profile step
let pendingAdminUser = null;    // Holds user pending admin choice modal

window.addEventListener('DOMContentLoaded', async () => {
  loadLiveCounts();
  startPHTClock();

  // If already signed in, redirect
  onAuthStateChanged(auth, async fbUser => {
    if (!fbUser) return;
    // Don't redirect if google modal is open (user is completing profile)
    const googleModal = document.getElementById('google-modal');
    if (googleModal && !googleModal.classList.contains('hidden')) return;
    const { getUserById } = await import('./storage.js');
    const profile = await getUserById(fbUser.uid);
    if (profile && !profile.isBlocked) handlePostLogin(profile);
  });
});

/* ── Post-login redirect logic ── */
function handlePostLogin(user) {
  if (canSwitchToAdmin(user)) {
    pendingAdminUser = user;
    showAdminChoiceModal(user);
  } else {
    redirectByRole(user);
  }
}

function redirectByRole(user) {
  if (user.activeRole === 'admin') window.location.href = 'dashboard.html';
  else                             window.location.href = 'checkin.html';
}

async function loadLiveCounts() {
  try {
    const [daily, weekly] = await Promise.all([getVisitsToday(), getVisitsThisWeek()]);
    const d = document.getElementById('daily-count');
    const w = document.getElementById('weekly-count');
    if (d) d.textContent = daily.length;
    if (w) w.textContent = weekly.length;
  } catch { /* non-critical */ }
}

/* ── PHT Real-Time Clock ── */
function startPHTClock() {
  function tick() {
    const now     = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { timeZone:'Asia/Manila', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
    const dateStr = now.toLocaleDateString('en-US', { timeZone:'Asia/Manila', weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const timeEl  = document.getElementById('clock-time');
    const dateEl  = document.getElementById('clock-date');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Tab switching ── */
function showTab(tab) {
  ['login','register'].forEach(t => {
    document.getElementById('form-' + t).classList.remove('active');
    document.getElementById('tab-' + t).classList.remove('active');
  });
  document.getElementById('form-' + tab).classList.add('active');
  document.getElementById('tab-'  + tab).classList.add('active');
  ['login-error','login-info','register-error','register-success'].forEach(hideAlert);
}
window.showTab = showTab;

/* ── EMAIL/PASSWORD LOGIN ── */
async function handleLogin() {
  const id  = document.getElementById('login-identifier').value.trim();
  const pwd = document.getElementById('login-password').value;
  hideAlert('login-error');
  if (!id || !pwd) { showAlert('login-error', 'Please enter your email/ID and password.'); return; }
  setLoading('login-btn', true, 'Signing in…');
  const res = await attemptLogin(id, pwd);
  setLoading('login-btn', false, 'Sign In to Library');
  if (!res.ok) { showAlert('login-error', res.error); return; }
  handlePostLogin(res.user);
}
window.handleLogin = handleLogin;

/* ── EMAIL/PASSWORD REGISTER ── */
async function handleRegister() {
  hideAlert('register-error'); hideAlert('register-success');
  const fn  = document.getElementById('reg-firstname').value.trim();
  const mi  = document.getElementById('reg-mi').value.trim();
  const ln  = document.getElementById('reg-lastname').value.trim();
  const sid = document.getElementById('reg-id').value.trim();
  const em  = document.getElementById('reg-email').value.trim().toLowerCase();
  const ut  = document.getElementById('reg-usertype').value;
  const col = document.getElementById('reg-college').value;
  const prg = document.getElementById('reg-program').value.trim();
  const pwd = document.getElementById('reg-password').value;

  if (!fn||!ln||!sid||!em||!ut||!col||!prg||!pwd) { showAlert('register-error','Please fill in all required fields.'); return; }
  if (!isInstitutionalEmail(em))   { showAlert('register-error','Email must be an NEU institutional address (@neu.edu.ph).'); return; }
  if (!isValidSchoolId(sid))       { showAlert('register-error','School ID must follow the format yy-xxxxx-xxx (e.g. 24-13384-401).'); return; }
  if (pwd.length < 6)              { showAlert('register-error','Password must be at least 6 characters.'); return; }

  setLoading('register-btn', true, 'Creating account…');
  const res = await attemptRegister({ firstName:fn, mi, lastName:ln, schoolId:sid, email:em, college:col, program:prg, userType:ut, password:pwd });
  setLoading('register-btn', false, 'Create Account');
  if (!res.ok) { showAlert('register-error', res.error); return; }
  showAlert('register-success', 'Account created! Redirecting…');
  setTimeout(() => handlePostLogin(res.user), 1200);
}
window.handleRegister = handleRegister;

/* ── GOOGLE SIGN-IN FLOW ── */
async function handleGoogleSignIn() {
  googleModalMode = 'login';
  setLoading('google-login-btn', true, 'Connecting…');
  const res = await attemptGoogleLogin();
  setLoading('google-login-btn', false, 'Continue with Google (@neu.edu.ph)');

  if (res.ok) { handlePostLogin(res.user); return; }
  if (res.needsProfile) {
    pendingGoogleUID = res.uid;
    openGoogleModal('google-new', res.email, res.firstName, res.lastName);
    return;
  }
  if (res.error) showAlert('login-error', res.error);
}
window.handleGoogleSignIn = handleGoogleSignIn;

async function handleGoogleRegister() {
  googleModalMode = 'register';
  setLoading('google-register-btn', true, 'Connecting…');
  const res = await attemptGoogleLogin();
  setLoading('google-register-btn', false, 'Register with Google (@neu.edu.ph)');

  if (res.ok) { handlePostLogin(res.user); return; }
  if (res.needsProfile) {
    pendingGoogleUID = res.uid;
    openGoogleModal('google-new', res.email, res.firstName, res.lastName);
    return;
  }
  if (res.error) showAlert('register-error', res.error);
}
window.handleGoogleRegister = handleGoogleRegister;

function openGoogleModal(mode, email='', firstName='', lastName='') {
  googleModalMode = mode;
  const modal = document.getElementById('google-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const stepEmail   = document.getElementById('google-step-email');
  const extraFields = document.getElementById('google-extra-fields');
  const modalTitle  = document.getElementById('google-modal-title');
  const modalNote   = document.getElementById('google-modal-note');

  if (mode === 'google-new') {
    if (stepEmail)   stepEmail.classList.add('hidden');
    if (extraFields) extraFields.classList.remove('hidden');
    if (modalTitle)  modalTitle.textContent = 'Complete Your Profile';
    if (modalNote)   modalNote.textContent  = 'Fill in your remaining details to finish registration.';
    const gFirst = document.getElementById('g-firstname');
    const gLast  = document.getElementById('g-lastname');
    const gEmail = document.getElementById('g-email-display');
    if (gFirst) gFirst.value = firstName;
    if (gLast)  gLast.value  = lastName;
    if (gEmail) gEmail.value = email;
    ['g-mi','g-schoolid','g-usertype','g-college','g-program'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } else {
    if (stepEmail)   stepEmail.classList.remove('hidden');
    if (extraFields) extraFields.classList.add('hidden');
    const emailInput = document.getElementById('google-email-input');
    if (emailInput)  { emailInput.value = ''; setTimeout(()=>emailInput.focus(), 80); }
    if (modalTitle)  modalTitle.textContent = mode === 'register' ? 'Register with Google' : 'Sign in with Google';
    if (modalNote)   modalNote.textContent  = 'Enter your NEU institutional Google email (@neu.edu.ph) to continue.';
  }
  hideAlert('modal-error');
}
window.openGoogleModal = openGoogleModal;

function closeGoogleModal() {
  const modal = document.getElementById('google-modal');
  if (modal) modal.classList.add('hidden');
  pendingGoogleUID = null;
}
window.closeGoogleModal = closeGoogleModal;

/* Legacy manual email step */
async function confirmGoogleEmail() {
  const email = document.getElementById('google-email-input')?.value.trim().toLowerCase() || '';
  hideAlert('modal-error');
  if (!email) { showAlert('modal-error','Please enter your NEU Google email.'); return; }
  if (!isInstitutionalEmail(email)) { showAlert('modal-error','Only @neu.edu.ph Google accounts are allowed.'); return; }
  const existing = await getUserByEmail(email);
  if (existing) {
    if (existing.isBlocked) { showAlert('modal-error','Your account has been blocked. Contact the library admin.'); return; }
    setSession(existing);
    closeGoogleModal();
    handlePostLogin(existing);
    return;
  }
  showAlert('modal-error', 'No account found. Please use the Google button to sign in — it will prompt you to complete your profile.');
}
window.confirmGoogleEmail = confirmGoogleEmail;

/* Profile completion for new Google users */
async function confirmGoogleRegisterProfile() {
  // Get the button and disable it immediately to prevent double clicks
  const btn = document.getElementById('google-profile-btn');
  if (!pendingGoogleUID) {
    showAlert('modal-error','Session expired. Please close and try signing in again.');
    return;
  }

  const email = document.getElementById('g-email-display')?.value.trim().toLowerCase() || '';
  const fn    = document.getElementById('g-firstname')?.value.trim()  || '';
  const mi    = document.getElementById('g-mi')?.value.trim()         || '';
  const ln    = document.getElementById('g-lastname')?.value.trim()   || '';
  const sid   = document.getElementById('g-schoolid')?.value.trim()   || '';
  const ut    = document.getElementById('g-usertype')?.value          || '';
  const col   = document.getElementById('g-college')?.value           || '';
  const prg   = document.getElementById('g-program')?.value.trim()    || '';
  hideAlert('modal-error');

  if (!fn||!ln||!sid||!ut||!col||!prg) {
    showAlert('modal-error','Please fill in all required fields.');
    return;
  }
  if (!isValidSchoolId(sid)) {
    showAlert('modal-error','School ID must follow the format yy-xxxxx-xxx (e.g. 24-13384-401).');
    return;
  }

  // Disable button and show loading
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res = await attemptGoogleRegisterProfile(pendingGoogleUID, {
      firstName:fn, mi, lastName:ln, schoolId:sid,
      userType:ut, college:col, program:prg, email
    });

    if (!res.ok) {
      showAlert('modal-error', res.error);
      if (btn) { btn.disabled = false; btn.textContent = 'Complete Registration'; }
      return;
    }

    closeGoogleModal();
    handlePostLogin(res.user);

  } catch (err) {
    console.error('Registration error:', err);
    showAlert('modal-error', 'Registration failed: ' + (err.message || 'Unknown error. Please try again.'));
    if (btn) { btn.disabled = false; btn.textContent = 'Complete Registration'; }
  }
}
window.confirmGoogleRegisterProfile = confirmGoogleRegisterProfile;

/* ── Admin Choice Modal ── */
function showAdminChoiceModal(user) {
  const nameEl = document.getElementById('admin-choice-name');
  if (nameEl) nameEl.textContent = fullName(user) + ' · ' + user.email;
  document.getElementById('admin-choice-modal')?.classList.remove('hidden');
}

async function adminChooseDashboard() {
  if (!pendingAdminUser) return;
  await switchActiveRole(pendingAdminUser.id, 'admin');
  document.getElementById('admin-choice-modal')?.classList.add('hidden');
  window.location.href = 'dashboard.html';
}
window.adminChooseDashboard = adminChooseDashboard;

async function adminChooseCheckin() {
  if (!pendingAdminUser) return;
  await switchActiveRole(pendingAdminUser.id, 'visitor');
  document.getElementById('admin-choice-modal')?.classList.add('hidden');
  window.location.href = 'checkin.html';
}
window.adminChooseCheckin = adminChooseCheckin;

/* ── Helpers ── */
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
function setLoading(id, loading, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled    = loading;
  el.textContent = label;
}

/* ── Enter key shortcuts ── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const adminOpen  = !document.getElementById('admin-choice-modal')?.classList.contains('hidden');
  if (adminOpen) return;
  const googleOpen = !document.getElementById('google-modal')?.classList.contains('hidden');
  if (googleOpen) {
    const extraVisible = !document.getElementById('google-extra-fields')?.classList.contains('hidden');
    if (extraVisible) confirmGoogleRegisterProfile();
    else confirmGoogleEmail();
    return;
  }
  const loginActive = document.getElementById('form-login')?.classList.contains('active');
  if (loginActive) handleLogin(); else handleRegister();
});