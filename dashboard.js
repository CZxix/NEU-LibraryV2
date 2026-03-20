/* =============================================
   dashboard.js – Admin Dashboard Logic
   NEU Library Visitor Management System v2
   ============================================= */

import { requireAdmin, canSwitchToAdmin, doSwitchRole, handleLogout, fullName, userTypeLabel } from './auth.js';
import {
  getUsers, getVisits, getVisitsToday, getVisitsThisWeek,
  getVisitsThisMonth, getVisitsByRange, toggleBlockUser,
  groupVisitsByCollege, groupVisitsByPurpose, groupVisitsByUserType,
  getDailyTrendFromVisits, isHardcodedAdmin,
} from './storage.js';

let currentAdmin = null;
let activeFilter = 'day';
let customStart  = null;
let customEnd    = null;
let allVisits    = [];    // cached for current render cycle
let allUsers     = [];    // cached for current render cycle
let trendChart=null, collegeChart=null, purposeChart=null, typeChart=null;

const NEU_BLUE='#003087', NEU_YELLOW='#F5C518', NEU_DARK='#0D1B2A', NEU_GREY='#5A6B7E';
const CHART_COLORS=['#003087','#004BB5','#1A6FD4','#F5C518','#0F7B55','#C0392B','#8E44AD','#E67E22','#16A085','#2C3E50'];

Chart.defaults.font.family = "'Source Sans 3', 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.color       = NEU_GREY;

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', async () => {
  currentAdmin = await requireAdmin();
  if (!currentAdmin) return;

  document.getElementById('admin-name-sidebar').textContent = fullName(currentAdmin);
  if (Array.isArray(currentAdmin.roles) && currentAdmin.roles.includes('visitor')) {
    document.getElementById('sb-switch-visitor').classList.remove('hidden');
  }
  const dateEl = document.getElementById('current-date-display');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-PH',{ weekday:'long',year:'numeric',month:'long',day:'numeric' });

  await refreshData();
  renderDashboard();
});

window.switchToVisitor = function() { doSwitchRole(currentAdmin, 'visitor'); };
window.handleLogout    = handleLogout;

async function refreshData() {
  [allVisits, allUsers] = await Promise.all([getVisits(), getUsers()]);
}

/* ── NAVIGATION ── */
window.navTo = function(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  const sectionId = el.getAttribute('data-section');
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  const titles = { 'section-overview':'Dashboard','section-visitors':'Visitor Logs','section-users':'User Management','section-reports':'Reports' };
  document.getElementById('page-title').textContent = titles[sectionId] || 'Dashboard';
  if (sectionId === 'section-visitors') renderVisitTable();
  if (sectionId === 'section-users')    renderUserTable();
};

/* ── PERIOD FILTERS ── */
window.setFilter = function(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cr = document.getElementById('custom-range');
  if (filter === 'custom') { cr.classList.remove('hidden'); }
  else { cr.classList.add('hidden'); customStart=null; customEnd=null; renderDashboard(); }
};

window.applyCustomRange = function() {
  customStart = document.getElementById('range-start').value;
  customEnd   = document.getElementById('range-end').value;
  if (!customStart||!customEnd) { alert('Please select both a start and end date.'); return; }
  renderDashboard();
};

window.clearFilters = function() {
  document.getElementById('filter-purpose').value  = '';
  document.getElementById('filter-college').value  = '';
  document.getElementById('filter-usertype').value = '';
  renderDashboard();
};

function getFilteredVisits() {
  let visits;
  const trendEl = document.getElementById('trend-label');

  if (activeFilter==='day')         { visits=allVisits.filter(v=>isSameDay(v.timestamp, new Date())); if(trendEl)trendEl.textContent='(Today)'; }
  else if (activeFilter==='week')   { const s=weekStart(); visits=allVisits.filter(v=>new Date(v.timestamp)>=s); if(trendEl)trendEl.textContent='(This Week)'; }
  else if (activeFilter==='month')  { const s=monthStart(); visits=allVisits.filter(v=>new Date(v.timestamp)>=s); if(trendEl)trendEl.textContent='(This Month)'; }
  else if (activeFilter==='custom'&&customStart&&customEnd) {
    const s=new Date(customStart), e=new Date(customEnd); e.setHours(23,59,59,999);
    visits=allVisits.filter(v=>{ const d=new Date(v.timestamp); return d>=s&&d<=e; });
    if(trendEl)trendEl.textContent=`(${customStart} – ${customEnd})`;
  } else { visits=allVisits.filter(v=>isSameDay(v.timestamp,new Date())); }

  const pf = document.getElementById('filter-purpose')?.value  || '';
  const cf = document.getElementById('filter-college')?.value  || '';
  const tf = document.getElementById('filter-usertype')?.value || '';
  if (pf) visits=visits.filter(v=>(v.purpose||'').includes(pf));
  if (cf) visits=visits.filter(v=>v.college===cf);
  if (tf) visits=visits.filter(v=>v.userType===tf);
  return visits;
}

function isSameDay(ts, date) {
  const d=new Date(ts);
  return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();
}
function weekStart()  { const d=new Date(); d.setDate(d.getDate()-d.getDay()); d.setHours(0,0,0,0); return d; }
function monthStart() { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); }

/* ── RENDER DASHBOARD ── */
window.renderDashboard = function() {
  const visits = getFilteredVisits();
  const types  = groupVisitsByUserType(visits);
  document.getElementById('stat-period').textContent   = visits.length;
  document.getElementById('stat-students').textContent = types.student;
  document.getElementById('stat-faculty').textContent  = types.faculty;
  document.getElementById('stat-staff').textContent    = types.staff;
  renderTrendChart(visits);
  renderCollegeChart(visits);
  renderPurposeChart(visits);
  renderTypeChart(visits);
};

function renderTrendChart(visits) {
  const days  = activeFilter==='day'?1:activeFilter==='week'?7:activeFilter==='month'?30:14;
  const trend = getDailyTrendFromVisits(visits, days);
  const ctx   = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx,{ type:'line', data:{ labels:trend.labels, datasets:[{ label:'Visitors', data:trend.counts, borderColor:NEU_BLUE, backgroundColor:'rgba(0,48,135,0.08)', borderWidth:2.5, pointBackgroundColor:NEU_BLUE, pointRadius:4, tension:0.35, fill:true }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,ticks:{stepSize:1,precision:0},grid:{color:'rgba(0,0,0,0.05)'}}, x:{grid:{display:false}} } } });
}
function renderCollegeChart(visits) {
  const g=groupVisitsByCollege(visits); const ctx=document.getElementById('collegeChart').getContext('2d');
  if (collegeChart) collegeChart.destroy();
  collegeChart=new Chart(ctx,{ type:'doughnut', data:{ labels:Object.keys(g), datasets:[{data:Object.values(g),backgroundColor:CHART_COLORS,borderWidth:2,borderColor:'#fff'}] }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:10,font:{size:11}}}},cutout:'60%'} });
}
function renderPurposeChart(visits) {
  const g=groupVisitsByPurpose(visits); const ctx=document.getElementById('purposeChart').getContext('2d');
  if (purposeChart) purposeChart.destroy();
  purposeChart=new Chart(ctx,{ type:'bar', data:{ labels:Object.keys(g), datasets:[{label:'Visits',data:Object.values(g),backgroundColor:Object.keys(g).map((_,i)=>CHART_COLORS[i%CHART_COLORS.length]),borderRadius:4,borderWidth:0}] }, options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0},grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false},ticks:{font:{size:10}}}}} });
}
function renderTypeChart(visits) {
  const g=groupVisitsByUserType(visits); const ctx=document.getElementById('typeChart').getContext('2d');
  if (typeChart) typeChart.destroy();
  typeChart=new Chart(ctx,{ type:'pie', data:{ labels:['Students','Faculty / Teachers','Staff / Employees'], datasets:[{data:[g.student,g.faculty,g.staff],backgroundColor:[NEU_BLUE,NEU_YELLOW,NEU_DARK],borderWidth:2,borderColor:'#fff'}] }, options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:10,font:{size:11}}}}} });
}

/* ── VISITOR LOG TABLE ── */
window.renderVisitTable = function() {
  const query  = (document.getElementById('log-search')?.value||'').toLowerCase();
  const tbody  = document.getElementById('visit-tbody');
  const visits = [...allVisits].reverse();

  const filtered = visits.filter(v => {
    const user = allUsers.find(u=>u.id===v.userId);
    if (!query) return true;
    const ts = new Date(v.timestamp);
    const datePart = ts.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric",weekday:"short"}).toLowerCase();
    const timePart = ts.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",hour12:true}).toLowerCase();
    const name     = user ? fullName(user).toLowerCase() : "";
    const email    = user ? (user.email||"").toLowerCase() : "";
    const type     = user ? userTypeLabel(user.userType).toLowerCase() : "";
    const college  = (v.college||"").toLowerCase();
    const purpose  = (v.purpose||"").toLowerCase();
    return name.includes(query)||email.includes(query)||datePart.includes(query)||timePart.includes(query)||type.includes(query)||college.includes(query)||purpose.includes(query);
  });

  if (filtered.length===0) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">No records found.</td></tr>`; return; }
  tbody.innerHTML = filtered.map(v => {
    const user=allUsers.find(u=>u.id===v.userId);
    const ts=new Date(v.timestamp);
    const datePart=ts.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric',weekday:'short'});
    const timePart=ts.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true});
    return `<tr>
      <td style="white-space:nowrap">${datePart}</td>
      <td style="white-space:nowrap;font-weight:600;color:var(--neu-blue)">${timePart}</td>
      <td style="white-space:nowrap">${user?fullName(user):'Unknown'}</td>
      <td style="color:var(--neu-grey);font-size:0.82rem">${user?user.email:'–'}</td>
      <td style="white-space:nowrap">${user?userTypeLabel(user.userType):'–'}</td>
      <td style="font-size:0.82rem">${v.college||'–'}</td>
      <td style="font-size:0.82rem">${v.purpose||'–'}</td>
    </tr>`;
  }).join('');
};

/* ── USER MANAGEMENT TABLE ── */
window.renderUserTable = function() {
  const query  = (document.getElementById('user-search')?.value||'').toLowerCase();
  const tbody  = document.getElementById('user-tbody');
  const filtered = allUsers.filter(u => {
    const name=fullName(u).toLowerCase(), email=(u.email||'').toLowerCase();
    return !query||name.includes(query)||email.includes(query);
  });
  if (filtered.length===0) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">No users found.</td></tr>`; return; }
  tbody.innerHTML = filtered.map(u => {
    const statusBadge = u.isBlocked?`<span class="badge-blocked">Blocked</span>`:`<span class="badge-active">Active</span>`;
    const isProtected = isHardcodedAdmin(u.email)&&u.roles.length===1&&u.roles.includes('admin');
    const actionBtn   = isProtected
      ? `<span style="font-size:0.75rem;color:var(--neu-grey);font-style:italic;">Protected</span>`
      : u.isBlocked
        ? `<button class="btn-unblock" onclick="toggleUser('${u.id}')">Unblock</button>`
        : `<button class="btn-block" onclick="toggleUser('${u.id}')">Block</button>`;
    const roleTag = u.roles.includes('admin')
      ? `<span style="font-size:0.72rem;background:#D6E4FF;color:var(--neu-blue);padding:1px 7px;border-radius:99px;font-weight:700;margin-left:5px;">Admin</span>` : '';
    return `<tr>
      <td style="white-space:nowrap">${fullName(u)}${roleTag}</td>
      <td style="color:var(--neu-grey);font-size:0.82rem">${u.email}</td>
      <td>${userTypeLabel(u.userType)}</td>
      <td style="font-size:0.82rem">${u.college||'–'}</td>
      <td style="font-size:0.82rem">${u.program||'–'}</td>
      <td>${statusBadge}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
};

window.toggleUser = async function(userId) {
  await toggleBlockUser(userId);
  allUsers = await getUsers(); // refresh
  renderUserTable();
};

/* ── CSV EXPORT ── */
window.exportCSV = function() { generateReport(activeFilter||'all'); };
