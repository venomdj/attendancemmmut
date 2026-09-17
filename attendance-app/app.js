/* ===================== STATE ===================== */
const STORE_KEY = "att_app_state_v1";

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){console.error("load failed",e)}
  return {
    threshold: DEFAULT_THRESHOLD,
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light',
    // records: { "YYYY-MM-DD|classId": "present"|"absent"|"cancelled" }
    records: {},
    holidays: {}, // "YYYY-MM-DD": true
    manualClasses: [], // extra one-off classes: {id,date,subject,type,start,end,room}
    semesterStart: null, // ISO date string, user-set; defaults to first Monday tracked
  };
}
let state = loadState();

function saveState(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch(e){ toast("Save failed — storage may be full"); }
}

document.documentElement.setAttribute('data-theme', state.theme);
document.getElementById('themeToggle').textContent = state.theme==='dark' ? '☀️' : '🌙';
document.getElementById('themeToggle').onclick = ()=>{
  state.theme = state.theme==='dark' ? 'light':'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeToggle').textContent = state.theme==='dark' ? '☀️' : '🌙';
  saveState();
};

/* ===================== DATE HELPERS ===================== */
function fmtDate(d){ return d.toISOString().slice(0,10); }
function todayStr(){ return fmtDate(new Date()); }
function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function dayName(n){ return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][n]; }
function fullDayName(n){ return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][n]; }
function niceDate(s){
  const d = parseDate(s);
  return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

/* Get scheduled classes for a given date (weekday match) + manual additions, minus holidays */
function classesForDate(dateStr){
  const d = parseDate(dateStr);
  const dow = d.getDay();
  if(state.holidays[dateStr]) return [];
  const scheduled = TIMETABLE.filter(c=>c.day===dow).map(c=>({...c, date:dateStr, key:dateStr+"|"+c.id}));
  const manual = state.manualClasses.filter(m=>m.date===dateStr).map(m=>({...m, key:dateStr+"|"+m.id}));
  return [...scheduled, ...manual].sort((a,b)=> a.start.localeCompare(b.start));
}

/* ===================== ATTENDANCE ENGINE ===================== */
// Iterate all dates from semester start (or first data point) to today, collect per-subject counts.
function getSemesterStart(){
  if(state.semesterStart) return parseDate(state.semesterStart);
  // default: most recent Monday minus a bit, or first recorded date
  const keys = Object.keys(state.records);
  if(keys.length){
    const dates = keys.map(k=>k.split('|')[0]).sort();
    return parseDate(dates[0]);
  }
  // fallback: 8 weeks ago
  return addDays(new Date(), -7*8);
}

function computeStats(){
  const start = getSemesterStart();
  const end = new Date();
  const perSubject = {}; // code -> {attended,total,cancelled}
  Object.keys(SUBJECTS).forEach(c=> perSubject[c] = {attended:0,total:0,cancelled:0,marked:0});

  let cur = new Date(start);
  while(cur <= end){
    const ds = fmtDate(cur);
    const classes = classesForDate(ds);
    classes.forEach(c=>{
      const status = state.records[c.key];
      const s = perSubject[c.subject];
      if(!s) return;
      if(status === 'cancelled'){ s.cancelled++; return; } // doesn't count toward total
      if(status === 'present'){ s.attended++; s.total++; s.marked++; }
      else if(status === 'absent'){ s.total++; s.marked++; }
      // unmarked past classes: not counted yet (pending)
    });
    cur = addDays(cur,1);
  }
  return perSubject;
}

function pct(s){ return s.total===0 ? 100 : Math.round((s.attended/s.total)*1000)/10; }

// classes needed to attend consecutively to reach threshold
function classesToReachThreshold(s, threshold){
  if(pct(s) >= threshold) return 0;
  let attended=s.attended, total=s.total, n=0;
  while(total===0 || (attended/total)*100 < threshold){
    attended++; total++; n++;
    if(n>500) break;
  }
  return n;
}
// how many can safely be missed and stay >= threshold
function safeToMiss(s, threshold){
  if(pct(s) < threshold) return 0;
  let attended=s.attended, total=s.total, n=0;
  while(true){
    const nt = total+1;
    if((attended/nt)*100 < threshold) break;
    total=nt; n++;
    if(n>500) break;
  }
  return n;
}

function overallStats(){
  const per = computeStats();
  let attended=0, total=0;
  Object.values(per).forEach(s=>{ attended+=s.attended; total+=s.total; });
  return { attended, total, pct: total===0?100:Math.round((attended/total)*1000)/10, per };
}

/* ===================== UI HELPERS ===================== */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove('show'), 1800);
}
function statusColor(p, threshold){
  if(p>=threshold) return 'good';
  if(p>=threshold-10) return 'warn';
  return 'bad';
}
function typeLabel(c){
  if(c.type==='practical') return `Practical${c.batch?' '+c.batch:''}`;
  if(c.type==='tutorial') return `Tutorial${c.batch?' '+c.batch:''}`;
  return 'Lecture';
}

/* ===================== VIEWS ===================== */
const main = document.getElementById('main');
const headerTitle = document.getElementById('headerTitle');
let currentView = 'today';
let selectedHistoryDate = todayStr();

function render(){
  if(currentView==='today') renderToday();
  else if(currentView==='subjects') renderSubjects();
  else if(currentView==='timetable') renderTimetable();
  else if(currentView==='calendar') renderCalendar();
  else if(currentView==='settings') renderSettings();
}

function renderToday(){
  headerTitle.textContent = "Today";
  const ds = todayStr();
  const classes = classesForDate(ds);
  const ov = overallStats();

  let lowWarnings = Object.entries(ov.per)
    .filter(([code,s])=> s.total>0 && pct(s) < state.threshold)
    .map(([code,s])=> `${SUBJECTS[code].name}: ${pct(s)}%`);

  main.innerHTML = `
    <div class="card">
      <h2>Overall Attendance</h2>
      <div class="big-stat"><span class="num" style="color:${ov.pct>=state.threshold?'var(--good)':'var(--bad)'}">${ov.pct}%</span>
        <span class="lbl">${ov.attended}/${ov.total} classes</span></div>
      <div class="progress"><div style="width:${Math.min(ov.pct,100)}%;background:${ov.pct>=state.threshold?'var(--good)':'var(--bad)'}"></div></div>
    </div>
    ${lowWarnings.length ? `<div class="card" style="border-color:var(--bad)">
      <h2 style="color:var(--bad)">⚠️ Low Attendance</h2>
      ${lowWarnings.map(w=>`<div class="class-meta" style="margin-bottom:4px">${w}</div>`).join('')}
    </div>` : ''}
    <div class="card">
      <h2>${fullDayName(new Date().getDay())}, ${niceDate(ds)}</h2>
      ${classes.length===0 ? `<div class="empty">No classes today 🎉</div>` :
        classes.map(c=>classItemHTML(c)).join('')}
      ${classes.length>0 ? `<button class="btn secondary" style="width:100%;margin-top:10px" onclick="markAllPresent('${ds}')">Mark all Present</button>`:''}
    </div>
    <div class="card">
      <h2>Quick Add</h2>
      <button class="btn secondary" style="width:100%" onclick="openManualClassForm('${ds}')">+ Add extra class today</button>
      <button class="btn secondary" style="width:100%;margin-top:8px" onclick="toggleHoliday('${ds}')">${state.holidays[ds]?'Unmark holiday':'Mark today as holiday'}</button>
    </div>
  `;
}

function classItemHTML(c){
  const status = state.records[c.key];
  const sub = SUBJECTS[c.subject];
  return `
  <div class="class-item">
    <div class="class-info">
      <div class="dot" style="background:${sub.color}"></div>
      <div>
        <div class="class-name">${sub.name}</div>
        <div class="class-meta">${c.start}–${c.end} · ${typeLabel(c)} · ${c.room}</div>
      </div>
    </div>
    <div class="mark-btns">
      <button class="mark-btn ${status==='present'?'active-p':''}" onclick="mark('${c.key}','present')" title="Present">✓</button>
      <button class="mark-btn ${status==='absent'?'active-a':''}" onclick="mark('${c.key}','absent')" title="Absent">✕</button>
      <button class="mark-btn ${status==='cancelled'?'active-c':''}" onclick="mark('${c.key}','cancelled')" title="Cancelled">–</button>
    </div>
  </div>`;
}

function mark(key, status){
  if(state.records[key] === status){ delete state.records[key]; } // tap again to clear
  else state.records[key] = status;
  saveState(); render();
}
function markAllPresent(ds){
  classesForDate(ds).forEach(c=>{ if(!state.records[c.key]) state.records[c.key]='present'; });
  saveState(); render(); toast("Marked all present");
}
function toggleHoliday(ds){
  if(state.holidays[ds]) delete state.holidays[ds];
  else state.holidays[ds]=true;
  saveState(); render();
}

function renderSubjects(){
  headerTitle.textContent = "Subjects";
  const ov = overallStats();
  main.innerHTML = `<div class="card"><h2>Subject-wise Attendance</h2>
    ${Object.entries(SUBJECTS).map(([code,sub])=>{
      const s = ov.per[code];
      const p = pct(s);
      const cls = statusColor(p, state.threshold);
      const need = classesToReachThreshold(s, state.threshold);
      const safe = safeToMiss(s, state.threshold);
      return `<div class="subject-row">
        <div>
          <div class="class-name">${sub.name}</div>
          <div class="class-meta">${s.attended}/${s.total} attended
            ${need>0?` · need ${need} more`:''}
            ${safe>0?` · can miss ${safe}`:''}
          </div>
        </div>
        <span class="badge ${cls}">${p}%</span>
      </div>`;
    }).join('')}
  </div>
  <div class="card">
    <h2>Threshold</h2>
    <div class="class-meta">Current minimum: ${state.threshold}%</div>
  </div>`;
}

function renderTimetable(){
  headerTitle.textContent = "Timetable";
  let html = '';
  for(let d=1; d<=6; d++){
    const items = TIMETABLE.filter(c=>c.day===d).sort((a,b)=>a.start.localeCompare(b.start));
    if(!items.length) continue;
    html += `<div class="card"><h2>${fullDayName(d)}</h2>
      ${items.map(c=>{
        const sub = SUBJECTS[c.subject];
        return `<div class="class-item">
          <div class="class-info">
            <div class="dot" style="background:${sub.color}"></div>
            <div><div class="class-name">${sub.name}</div>
            <div class="class-meta">${c.start}–${c.end} · ${typeLabel(c)} · ${c.room}${c.faculty?' · '+c.faculty:''}</div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  main.innerHTML = html;
}

function renderCalendar(){
  headerTitle.textContent = "History";
  const ds = selectedHistoryDate;
  // simple week strip around selected date
  const base = parseDate(ds);
  const monday = addDays(base, -((base.getDay()+6)%7));
  let strip = '<div class="week-cal">';
  for(let i=0;i<7;i++){
    const d = addDays(monday,i);
    const s = fmtDate(d);
    strip += `<div class="day-cell ${s===ds?'sel':''}" onclick="selectedHistoryDate='${s}';render()">
      <div>${dayName(d.getDay())}</div><div>${d.getDate()}</div></div>`;
  }
  strip += '</div>';

  const classes = classesForDate(ds);
  main.innerHTML = `<div class="card">
    <h2>Edit Attendance Record</h2>
    ${strip}
    <div class="class-meta" style="margin-bottom:8px">${niceDate(ds)}</div>
    ${classes.length===0? `<div class="empty">No classes this day</div>` :
      classes.map(c=>classItemHTML(c)).join('')}
  </div>`;
}

function renderSettings(){
  headerTitle.textContent = "Settings";
  main.innerHTML = `
  <div class="card">
    <h2>Minimum Attendance %</h2>
    <input type="number" id="thresholdInput" value="${state.threshold}" min="1" max="100">
    <button class="btn" style="margin-top:10px" onclick="saveThreshold()">Save</button>
  </div>
  <div class="card">
    <h2>Notifications</h2>
    <button class="btn secondary" style="width:100%" onclick="requestNotifPermission()">Enable class reminders</button>
    <div class="class-meta" style="margin-top:8px">Reminds you to mark attendance ~10 min after each class ends, and warns when a subject nears the threshold. Requires the app to be open or installed as a PWA.</div>
  </div>
  <div class="card">
    <h2>Backup & Restore</h2>
    <button class="btn secondary" style="width:100%" onclick="exportData()">Export data (JSON)</button>
    <label>Import data</label>
    <input type="file" id="importFile" accept="application/json">
  </div>
  <div class="card">
    <h2>Cloud Sync</h2>
    <div class="class-meta">Not connected. This build stores data locally on this device (localStorage). To enable Firebase sync: create a Firebase project, add your config to <code>firebase-config.js</code>, and uncomment the sync calls in <code>app.js</code> — see SETUP.md for step-by-step instructions.</div>
  </div>
  <div class="card">
    <h2>Semester</h2>
    <div class="class-meta">Generic ${SEMESTER_WEEKS}-week semester. Stats are computed from your first recorded date to today.</div>
  </div>
  `;
  document.getElementById('importFile').onchange = importData;
}
function saveThreshold(){
  const v = parseInt(document.getElementById('thresholdInput').value,10);
  if(v>=1 && v<=100){ state.threshold=v; saveState(); toast("Threshold updated"); render(); }
}
function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`attendance-backup-${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
}
function importData(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      state = {...loadState(), ...data};
      saveState(); toast("Data imported"); render();
    }catch(err){ toast("Invalid backup file"); }
  };
  reader.readAsText(file);
}

function openManualClassForm(ds){
  const name = prompt("Subject code (e.g. BSM-110):");
  if(!name || !SUBJECTS[name]) { toast("Unknown subject code"); return; }
  const start = prompt("Start time (HH:MM):","09:00");
  const end = prompt("End time (HH:MM):","10:00");
  if(!start||!end) return;
  const id = 'manual-'+Date.now();
  state.manualClasses.push({id, date:ds, subject:name, type:'lecture', start, end, room:'—'});
  saveState(); render(); toast("Class added");
}

/* ===================== NOTIFICATIONS ===================== */
function requestNotifPermission(){
  if(!('Notification' in window)){ toast("Notifications not supported"); return; }
  Notification.requestPermission().then(p=>{
    if(p==='granted'){ toast("Reminders enabled"); scheduleReminders(); }
    else toast("Permission denied");
  });
}
function scheduleReminders(){
  // Checks every 5 min while app is open; for a real background PWA, a service worker
  // with periodic sync / push would be needed (documented in SETUP.md).
  setInterval(()=>{
    const now = new Date();
    const ds = todayStr();
    classesForDate(ds).forEach(c=>{
      const [eh,em] = c.end.split(':').map(Number);
      const endTime = new Date(); endTime.setHours(eh,em+10,0,0); // 10 min after class ends
      const diff = now - endTime;
      if(diff>=0 && diff < 5*60*1000 && !state.records[c.key]){
        new Notification("Mark attendance", {body:`${SUBJECTS[c.subject].name} just ended — tap to mark it.`});
      }
    });
  }, 5*60*1000);
}
if(Notification && Notification.permission==='granted') scheduleReminders();

/* ===================== NAV ===================== */
document.querySelectorAll('.tab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    currentView = tab.dataset.view;
    render();
  };
});

/* ===================== PWA / SERVICE WORKER ===================== */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

render();
