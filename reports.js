/* =============================================
   reports.js – CSV report generation
   NEU Library Visitor Management System v2
   ============================================= */

import { getUsers, getVisits, getVisitsToday, getVisitsThisWeek, getVisitsThisMonth, getVisitsByRange } from './storage.js';
import { userTypeLabel } from './auth.js';

window.generateReport = async function(period) {
  let visits=[], label='';
  const now=new Date();
  if (period==='today'||period==='day')   { visits=await getVisitsToday();     label='Today_'+now.toISOString().slice(0,10); }
  else if (period==='week')               { visits=await getVisitsThisWeek();   label='ThisWeek_'+now.toISOString().slice(0,10); }
  else if (period==='month')              { visits=await getVisitsThisMonth();  label='ThisMonth_'+now.toISOString().slice(0,7); }
  else                                    { visits=await getVisits();           label='AllRecords_'+now.toISOString().slice(0,10); }
  buildCSV(visits, label);
};

window.generateCustomReport = async function() {
  const start=document.getElementById('report-start').value;
  const end  =document.getElementById('report-end').value;
  if (!start||!end) { alert('Please select both a start and end date.'); return; }
  const visits=await getVisitsByRange(start,end);
  buildCSV(visits, `Custom_${start}_to_${end}`);
};

async function buildCSV(visits, fileLabel) {
  const users=await getUsers();
  const headers=['Date','Check-In Time','Last Name','First Name','M.I.','School ID','Email','User Type','College / Department','Program / Position','Purpose of Visit'];
  const rows=visits.slice().reverse().map(v=>{
    const user=users.find(u=>u.id===v.userId);
    const ts=new Date(v.timestamp);
    return [
      ts.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric',weekday:'short'}),
      ts.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true}),
      user?user.lastName:'Unknown',
      user?user.firstName:'Unknown',
      user?(user.mi||')':'',
      user?(user.schoolId||')':'',
      user?user.email:'',
      user?userTypeLabel(user.userType):'',
      v.college||'',
      user?(user.program||')':'',
      v.purpose||'',
    ];
  });
  function escape(val) { const s=String(val??''); if(s.includes(',')||s.includes('"')||s.includes('\n'))return '"'+s.replace(/"/g,'""')+'"'; return s; }
  const csvLines=[`# NEU Library Visitor Management System`,`# Generated: ${new Date().toLocaleString('en-PH')}`,`# Records: ${visits.length}`,'',headers.map(escape).join(','),...rows.map(r=>r.map(escape).join(','))];
  const blob=new Blob([csvLines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`NEU_Library_${fileLabel}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
