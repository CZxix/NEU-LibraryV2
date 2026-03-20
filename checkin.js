/* =============================================
   checkin.js – Visitor check-in logic
   NEU Library Visitor Management System v2
   ============================================= */

import { requireAuth, canSwitchToAdmin, doSwitchRole, handleLogout, fullName } from './auth.js';
import { createVisit } from './storage.js';

let currentUser  = null;
let signoutTimer = null;

window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  if (currentUser.activeRole === 'admin') { window.location.href = 'dashboard.html'; return; }

  document.getElementById('header-name').textContent       = fullName(currentUser);
  document.getElementById('visitor-display-name').textContent = currentUser.firstName;

  if (canSwitchToAdmin(currentUser)) {
    document.getElementById('btn-switch-admin').classList.remove('hidden');
  }

  const cs = document.getElementById('visit-college');
  if (cs && currentUser.college) {
    for (let o of cs.options) { if (o.value === currentUser.college) { o.selected = true; break; } }
  }
});

window.switchToAdmin = function() { doSwitchRole(currentUser, 'admin'); };
window.handleLogout  = handleLogout;

function getSelectedPurposes() {
  const boxes = document.querySelectorAll('#purpose-checkboxes input[type="checkbox"]:checked');
  return Array.from(boxes).map(cb => cb.value);
}

window.handleCheckin = async function() {
  const purposes = getSelectedPurposes();
  const college  = document.getElementById('visit-college').value;
  document.getElementById('checkin-error').classList.add('hidden');

  if (purposes.length === 0) { showError('Please select at least one purpose of visit.'); return; }
  if (!college)              { showError('Please select your college or department.'); return; }

  const btn = document.querySelector('.checkin-card .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking in…'; }

  try {
    const purposeLabel = purposes.join(', ');
    const visit        = await createVisit(currentUser.id, { purpose: purposeLabel, college });
    showSuccess(purposeLabel, college, visit.timestamp);
  } catch (err) {
    showError('Check-in failed. Please try again.');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Check In Now'; }
  }
};

function showSuccess(purpose, college, timestamp) {
  document.getElementById('step-form').classList.add('hidden');
  const sc = document.getElementById('step-success');
  sc.classList.remove('hidden');

  document.getElementById('success-name-display').textContent =
    fullName(currentUser) + ' • ' + (currentUser.schoolId || currentUser.email);
  document.getElementById('success-purpose').textContent = '📖 ' + purpose;
  document.getElementById('success-college').textContent = '🏫 ' + college;
  document.getElementById('success-time').textContent    =
    '🕒 ' + new Date(timestamp).toLocaleString('en-PH', {
      weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    });

  startSignoutCountdown(3);
}

function startSignoutCountdown(seconds) {
  const el = document.getElementById('signout-countdown');
  if (!el) return;
  let remaining = seconds;
  function tick() {
    el.innerHTML = `Signing out in <strong>${remaining}</strong> second${remaining !== 1 ? 's' : ''}…`;
    if (remaining <= 0) { el.textContent = 'Signing out…'; clearInterval(signoutTimer); handleLogout(); return; }
    remaining--;
  }
  tick();
  signoutTimer = setInterval(tick, 1000);
}

window.resetCheckin = function() {
  if (signoutTimer) { clearInterval(signoutTimer); signoutTimer = null; }
  document.querySelectorAll('#purpose-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById('visit-college').value = '';
  document.getElementById('step-success').classList.add('hidden');
  document.getElementById('step-form').classList.remove('hidden');
  document.getElementById('signout-countdown').textContent = '';
  const cs = document.getElementById('visit-college');
  if (cs && currentUser?.college) {
    for (let o of cs.options) { if (o.value === currentUser.college) { o.selected = true; break; } }
  }
};

function showError(msg) {
  const el = document.getElementById('checkin-error');
  el.textContent = msg; el.classList.remove('hidden');
}
