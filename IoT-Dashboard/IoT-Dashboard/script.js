/* ══════════════════════════════════════════════════════════════
   JAVASCRIPT — COMPLETE REWRITE FOR FIREBASE REAL-TIME
   ══════════════════════════════════════════════════════════════
   REMOVED: All static RAW data array, CSV logic, schedule(),
            togglePause(), idx counter, static chart data

   ADDED:   Firebase init, onValue() listener on "sensor/",
            Rolling history buffers (last 20 per sensor),
            Live chart.update() without recreation,
            Smart multi-alert system with auto-clear,
            Live data log table (last 50 readings),
            Session running averages,
            Firebase connection status indicator
   ══════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// FIX ②: SECS declared at TOP of script — the HTML onclick='showSec()'
// attributes fire before script parsing completes. Declaring SECS here
// prevents 'Cannot access SECS before initialization' (TDZ error).
// ══════════════════════════════════════════════
const SECS = ['overview', 'charts', 'table'];

// 1. FIREBASE INITIALISATION
// ══════════════════════════════════════════════


firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ══════════════════════════════════════════════
// 2. ALERT THRESHOLDS (as specified)
// ══════════════════════════════════════════════
const THRESHOLDS = {
  temp:    { max: 32,  label: 'High Temperature',  unit: '°C',  card: 'c-temp'  },
  hum:     { min: 40,  label: 'Low Humidity',       unit: '%',   card: 'c-hum'   },
  mq135:   { max: 230, label: 'Air Quality Danger', unit: 'ppm', card: 'c-mq135' },
  mq2:     { max: 180, label: 'Gas Leak Warning',   unit: 'ppm', card: 'c-mq2'   },
  mq6:     { max: 240, label: 'LPG Gas Danger',     unit: 'ppm', card: 'c-mq6'   },
  sound:   { max: 70,  label: 'Noise Alert',        unit: 'dB',  card: 'c-snd'   }
};

// ══════════════════════════════════════════════
// 3. STATE
// ══════════════════════════════════════════════
const MAX_HISTORY = 20;   // rolling window for charts
const MAX_LOG     = 50;   // rows kept in data log table

// Rolling buffers — last 20 values per sensor
const history = {
  labels: [],   // timestamp strings
  temp:   [], hum:    [],
  mq135:  [], mq2:    [],
  mq6:    [], sound:  []
};

// Running session totals for averages
const totals = { temp:0, hum:0, mq135:0, mq2:0, mq6:0, sound:0 };
const counts = { temp:0, hum:0, mq135:0, mq2:0, mq6:0, sound:0 };

// Live data log (last 50 readings, newest first)
let dataLog = [];

// Chart instances (created once, updated in-place)
const charts = {};
let chartsBuilt = false;

// Currently active alerts map: sensorKey → true/false
const activeAlerts = {};

// Update counter
let updateCount = 0;

// Table state
let filtered = [], sk = 'ts', sa = false, pg = 1;
const PP = 15;

// Chart auto-advance
const CO       = ['temp','hum','mq135','mq2','mq6','snd'];
let caIdx      = 0;
let cauto      = true;
let caTimer    = null;
let caAF       = null;
let caStart    = null;
const CA_INT   = 5000;

// ══════════════════════════════════════════════
// 4. UTILITIES (kept identical to original)
// ══════════════════════════════════════════════
const clamp = (v,lo,hi) => Math.min(Math.max(v,lo),hi);
const pct   = (v,lo,hi) => clamp(((v-lo)/(hi-lo))*100,0,100)+'%';
const fmt   = (v,d=1)   => v==null ? '<span class="nv">—</span>' : Number(v).toFixed(d);

function animN(el, target, dec=1){
  if(target == null){ el.textContent = '--'; return; }
  const prev = parseFloat(el.textContent) || 0;
  const dur  = 500, t0 = performance.now();
  const s = ts => {
    const p = Math.min((ts-t0)/dur, 1), e = 1-Math.pow(1-p,3);
    el.textContent = (prev+(target-prev)*e).toFixed(dec);
    if(p<1) requestAnimationFrame(s);
    else    el.textContent = target.toFixed(dec);
  };
  requestAnimationFrame(s);
}

function fl(id){
  const c = document.getElementById(id);
  c.classList.remove('fl');
  void c.offsetWidth;
  c.classList.add('fl');
}

// Live clock — unchanged
setInterval(()=>{
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}, 1000);
document.getElementById('clock').textContent =
  new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

// ══════════════════════════════════════════════
// 5. SECTION SWITCHING — identical to original
// ══════════════════════════════════════════════
function showSec(s){
  SECS.forEach(id => document.getElementById('sec-'+id).style.display = id===s ? 'block' : 'none');
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', SECS[i]===s));
  if(s === 'charts') buildCharts();
  if(s === 'table')  renderTbl();
}

// ══════════════════════════════════════════════
// 6. FIREBASE STATUS INDICATOR
// ══════════════════════════════════════════════
function setFbStatus(state, text){
  const el = document.getElementById('fbStatus');
  el.className = 'fb-status ' + state;
  document.getElementById('fbStatusText').textContent = text;
}

// ══════════════════════════════════════════════
// 7. SMART ALERT SYSTEM
//    — One alert item per sensor in #alertList
//    — Auto-removes when value returns to normal
//    — Card blinks red while in alert state
// ══════════════════════════════════════════════
function checkAlerts(data){
  const checks = [
    { key:'temp',  val:data.temp,    exceeded: data.temp  != null && data.temp  > THRESHOLDS.temp.max,
      msg: `🌡️ High Temperature: ${data.temp}°C (limit: ${THRESHOLDS.temp.max}°C)` },
    { key:'hum',   val:data.hum,     exceeded: data.hum   != null && data.hum   < THRESHOLDS.hum.min,
      msg: `💧 Low Humidity: ${data.hum}% (min: ${THRESHOLDS.hum.min}%)` },
    { key:'mq135', val:data.mq135,   exceeded: data.mq135 != null && data.mq135 > THRESHOLDS.mq135.max,
      msg: `🟣 Air Quality Danger: MQ-135 = ${data.mq135} ppm (limit: ${THRESHOLDS.mq135.max})` },
    { key:'mq2',   val:data.mq2,     exceeded: data.mq2   != null && data.mq2   > THRESHOLDS.mq2.max,
      msg: `🔴 Gas Leak Warning: MQ-2 = ${data.mq2} ppm (limit: ${THRESHOLDS.mq2.max})` },
    { key:'mq6',   val:data.mq6,     exceeded: data.mq6   != null && data.mq6   > THRESHOLDS.mq6.max,
      msg: `🟦 LPG Gas Danger: MQ-6 = ${data.mq6} ppm (limit: ${THRESHOLDS.mq6.max})` },
    { key:'sound', val:data.sound,   exceeded: data.sound != null && data.sound > THRESHOLDS.sound.max,
      msg: `🔊 Noise Alert: Sound = ${data.sound} dB (limit: ${THRESHOLDS.sound.max})` }
  ];

  const list = document.getElementById('alertList');

  checks.forEach(({ key, exceeded, msg }) => {
    const cardEl = document.getElementById(THRESHOLDS[key]?.card);
    const itemId = 'alert-' + key;

    if(exceeded){
      // Add to alert list if not already shown
      if(!activeAlerts[key]){
        activeAlerts[key] = true;
        const item = document.createElement('div');
        item.className = 'alert-item';
        item.id        = itemId;
        item.innerHTML = `<span class="icon">⚠️</span><span class="msg">${msg}</span>`;
        list.appendChild(item);
      } else {
        // Update message text with latest value
        const existing = document.getElementById(itemId);
        if(existing) existing.querySelector('.msg').textContent = msg;
      }
      // Highlight card
      if(cardEl){ cardEl.classList.add('in-alert'); cardEl.classList.remove('fl'); }

    } else {
      // Value returned to normal — auto-remove alert
      if(activeAlerts[key]){
        activeAlerts[key] = false;
        const existing = document.getElementById(itemId);
        if(existing) existing.remove();
      }
      // Remove card highlight
      if(cardEl) cardEl.classList.remove('in-alert');
    }
  });
}

// ══════════════════════════════════════════════
// 8. UPDATE CARDS (same IDs as original)
// ══════════════════════════════════════════════
function updateCards(data){
  // Flash all cards on every update
  ['c-temp','c-hum','c-mq135','c-mq2','c-mq6','c-snd'].forEach(id => {
    if(!document.getElementById(id).classList.contains('in-alert')) fl(id);
  });

  // Animate values
  animN(document.getElementById('v-temp'),   data.temp,   1);
  animN(document.getElementById('v-hum'),    data.hum,    1);
  animN(document.getElementById('v-mq135'),  data.mq135,  0);
  animN(document.getElementById('v-mq2'),    data.mq2,    0);
  animN(document.getElementById('v-mq6'),    data.mq6,    0);
  animN(document.getElementById('v-snd'),    data.sound,  0);

  // Progress bars (same ranges as original)
  if(data.temp   != null) document.getElementById('b-temp').style.width   = pct(data.temp,   20,  40);
  if(data.hum    != null) document.getElementById('b-hum').style.width    = pct(data.hum,    20, 100);
  if(data.mq135  != null) document.getElementById('b-mq135').style.width  = pct(data.mq135, 100, 280);
  if(data.mq2    != null) document.getElementById('b-mq2').style.width    = pct(data.mq2,   50,  220);
  if(data.mq6    != null) document.getElementById('b-mq6').style.width    = pct(data.mq6,   20,  300);
  if(data.sound  != null) document.getElementById('b-snd').style.width    = pct(data.sound, 20,  120);

  // Descriptive tags
  const t = data.temp;
  document.getElementById('tg-temp').textContent =
    t == null ? '—' : t > 35 ? '🔥 Hot' : t > 32 ? '⚠ Warm' : t > 25 ? 'Normal' : '❄ Cool';

  const h = data.hum;
  document.getElementById('tg-hum').textContent =
    h == null ? '—' : h > 70 ? 'Very Humid' : h > 60 ? 'Humid' : h > 40 ? 'Normal' : '⚠ Dry';

  // Update row pill
  document.getElementById('rowPill').textContent = `Readings: ${updateCount}`;
  document.getElementById('lu').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
}

// ══════════════════════════════════════════════
// 9. SESSION RUNNING AVERAGES
// ══════════════════════════════════════════════
function updateStats(data){
  const keys = ['temp','hum','mq135','mq2','mq6','sound'];
  const ids  = ['s-temp','s-hum','s-mq135','s-mq2','s-mq6','s-snd'];
  const units= ['°C','%','','','','dB'];
  const fields = [data.temp, data.hum, data.mq135, data.mq2, data.mq6, data.sound];

  keys.forEach((k,i) => {
    if(fields[i] != null){
      totals[k] += fields[i];
      counts[k]++;
    }
    const av = counts[k] ? (totals[k]/counts[k]).toFixed(1) : '--';
    document.getElementById(ids[i]).textContent = av + (counts[k] ? units[i] : '');
  });

  // Update count
  document.getElementById('s-ok').textContent = updateCount;
}

// ══════════════════════════════════════════════
// 10. ROLLING HISTORY & CHART PUSH
//     Pushes new value into 20-item rolling buffer
//     then calls chart.update() — NO chart recreation
// ══════════════════════════════════════════════
function pushHistory(data){
  const ts = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // Helper: push & trim to MAX_HISTORY
  function pushTrim(arr, val){
    arr.push(val != null ? val : null);
    if(arr.length > MAX_HISTORY) arr.shift();
  }

  pushTrim(history.labels, ts);
  pushTrim(history.temp,   data.temp);
  pushTrim(history.hum,    data.hum);
  pushTrim(history.mq135,  data.mq135);
  pushTrim(history.mq2,    data.mq2);
  pushTrim(history.mq6,    data.mq6);
  pushTrim(history.sound,  data.sound);

  // Live-update existing charts (no recreation)
  if(chartsBuilt){
    const keys = ['temp','hum','mq135','mq2','mq6','sound'];
    const ids  = ['ch-temp','ch-hum','ch-mq135','ch-mq2','ch-mq6','ch-snd'];
    keys.forEach((k,i) => {
      const ch = charts[ids[i]];
      if(!ch) return;
      ch.data.labels            = [...history.labels];
      ch.data.datasets[0].data  = [...history[k]];
      ch.update('active');   // smooth live update, no full re-render
    });
  }
}

// ══════════════════════════════════════════════
// 11. LIVE DATA LOG (table, last 50 readings)
// ══════════════════════════════════════════════
function pushLog(data){
  const ts = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const isAlert = Object.values(activeAlerts).some(Boolean);
  dataLog.unshift({ ts, seq: updateCount, ...data, isAlert });
  if(dataLog.length > MAX_LOG) dataLog.pop();
  filtered = [...dataLog];
  if(document.getElementById('sec-table').style.display !== 'none') renderTbl();
}

// ══════════════════════════════════════════════
// 12. CHART INIT — built once, updated in place
// ══════════════════════════════════════════════
const tooltipCfg = {
  backgroundColor:'rgba(4,10,28,.97)',titleColor:'#00c8ff',bodyColor:'#e8f4ff',
  borderColor:'rgba(0,200,255,.2)',borderWidth:1,padding:10,cornerRadius:8,
  callbacks:{ title: items => `T: ${items[0].label}` }
};
const xCfg = {
  ticks:{color:'#243548',font:{family:"'Share Tech Mono'",size:8},maxTicksLimit:10,maxRotation:0},
  grid:{color:'rgba(0,200,255,.03)'},border:{color:'rgba(0,200,255,.06)'}
};
// FIX: Straight-line problem — hard min/max locked Y axis to wide range
// (e.g. 0-100%) making tiny real-world variations look completely flat.
// SOLUTION: suggestedMin/suggestedMax lets Chart.js auto-zoom to actual
// data so even small fluctuations (e.g. 43.0-44.5%) render as real curves.
const yCfg = (sugMin, sugMax, dec) => ({
  suggestedMin: sugMin,
  suggestedMax: sugMax,
  ticks:{
    color:'#243548',
    font:{family:"'Share Tech Mono'",size:9},
    callback: v => typeof v === 'number' ? v.toFixed(dec) : v
  },
  grid:{color:'rgba(0,200,255,.05)'},
  border:{color:'rgba(0,200,255,.06)'}
});

function mkLine(id, data, color, ymin, ymax, dec=1, extra={}){
  const ctx = document.getElementById(id).getContext('2d');
  const g   = ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0,   color.replace('rgb(','rgba(').replace(')',',0.32)'));
  g.addColorStop(0.6, color.replace('rgb(','rgba(').replace(')',',0.08)'));
  g.addColorStop(1,   color.replace('rgb(','rgba(').replace(')',',0)'));
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [...history.labels], datasets:[{
      data: [...data], borderColor:color, backgroundColor:g,
      borderWidth:2.2, pointRadius:3, pointHoverRadius:6,
      pointBackgroundColor:color, pointBorderColor:'rgba(4,10,28,.8)',
      pointBorderWidth:1.5, fill:true, tension:0.38, spanGaps:true, ...extra
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{duration:400, easing:'easeInOutQuart'},
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false}, tooltip:tooltipCfg},
      scales:{x:xCfg, y:yCfg(ymin,ymax,dec)}
    }
  });
}

function mkBar(id, data, color, ymin, ymax, dec=1){
  const ctx = document.getElementById(id).getContext('2d');
  const g   = ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0, color.replace('rgb(','rgba(').replace(')',',0.8)'));
  g.addColorStop(1, color.replace('rgb(','rgba(').replace(')',',0.15)'));
  return new Chart(ctx, {
    type: 'bar',
    data: { labels: [...history.labels], datasets:[{
      data: [...data], backgroundColor:g, borderColor:color,
      borderWidth:1.5, borderRadius:3, borderSkipped:false,
      hoverBackgroundColor:color.replace('rgb(','rgba(').replace(')',',0.9)')
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{duration:400, easing:'easeInOutQuart'},
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false}, tooltip:tooltipCfg},
      scales:{x:xCfg, y:yCfg(ymin,ymax,dec)}
    }
  });
}

function buildCharts(){
  if(chartsBuilt) return;
  chartsBuilt = true;
  // Build each chart with current (possibly empty) history buffers
  // Y-axis ranges tuned to typical sensor values + threshold headroom
  // suggestedMin/Max = soft Y boundary; axis auto-zooms to actual data range
  // Humidity: real range ~40-80% but axis won't lock to 0-100 anymore
  // Sound: real quiet ~30-50dB but spikes visible; axis adapts dynamically
  charts['ch-temp']  = mkLine('ch-temp',  history.temp,  'rgb(255,107,53)',  20,  40,  1);
  charts['ch-hum']   = mkLine('ch-hum',   history.hum,   'rgb(0,200,255)',   35,  80,  1);  // CHANGED: bar→line
  charts['ch-mq135'] = mkLine('ch-mq135', history.mq135, 'rgb(168,85,247)',  50,  280, 0);
  charts['ch-mq2']   = mkLine('ch-mq2',   history.mq2,   'rgb(255,61,90)',   50,  220, 0);
  charts['ch-mq6']   = mkLine('ch-mq6',   history.mq6,   'rgb(0,229,204)',   20,  280, 0, {pointRadius:3,tension:0.2});
  charts['ch-snd']   = mkLine('ch-snd',   history.sound, 'rgb(0,255,157)',   20,  100, 0);  // CHANGED: bar→line
  startChartAuto();
}

// ══════════════════════════════════════════════
// 13. CHART AUTO-ADVANCE — identical to original
// ══════════════════════════════════════════════
function showChart(key, auto=false){
  if(!auto){ caIdx = CO.indexOf(key); resetCAnim(); }
  CO.forEach(k => {
    document.getElementById('cp-'+k).classList.toggle('active', k===key);
    document.getElementById('ct-'+k).classList.toggle('active', k===key);
  });
}
function jumpChart(key){ showSec('charts'); setTimeout(()=>showChart(key), 60); }

function resetCAnim(){
  cancelAnimationFrame(caAF);
  document.getElementById('caf').style.width='0%';
  if(cauto) animCAbar();
}
function animCAbar(){
  caStart = performance.now();
  const bar = document.getElementById('caf'), lbl = document.getElementById('cal');
  const step = ts => {
    const p = Math.min((ts-caStart)/CA_INT, 1);
    bar.style.width = (p*100)+'%';
    lbl.textContent = 'Next in '+Math.max(0,Math.ceil((CA_INT-(ts-caStart))/1000))+'s';
    if(p<1) caAF = requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function startChartAuto(){
  if(caTimer) clearInterval(caTimer);
  caTimer = setInterval(()=>{
    if(!cauto) return;
    caIdx = (caIdx+1) % CO.length;
    showChart(CO[caIdx], true);
    animCAbar();
  }, CA_INT);
  animCAbar();
}
function toggleChartAuto(){
  cauto = !cauto;
  const b = document.getElementById('caBtn');
  if(!cauto){ cancelAnimationFrame(caAF); b.textContent='▶ Auto'; b.classList.add('paused'); }
  else       { b.textContent='⏸ Auto'; b.classList.remove('paused'); animCAbar(); }
}

// ══════════════════════════════════════════════
// 14. LIVE DATA LOG TABLE
// ══════════════════════════════════════════════
function filterTbl(){
  const q  = (document.getElementById('sb').value || '').toLowerCase();
  const sf = document.getElementById('sf').value;
  filtered = dataLog.filter(r => {
    const mf = sf === 'alert'  ? r.isAlert  :
               sf === 'normal' ? !r.isAlert : true;
    const mq = q ? (r.ts.includes(q) ||
      String(r.temp).includes(q) || String(r.hum).includes(q) ||
      String(r.mq135).includes(q) || String(r.mq2).includes(q)) : true;
    return mf && mq;
  });
  pg = 1; renderTbl();
}

function sortTbl(k){
  if(sk===k) sa=!sa; else { sk=k; sa=true; }
  document.querySelectorAll('th').forEach(th=>th.classList.remove('asc','desc'));
  const keys=['ts','Temp','Humidity','MQ135','MQ2','MQ6','Sound'];
  const ki=keys.indexOf(k);
  if(ki>=0){ const ths=document.querySelectorAll('th'); ths[ki].classList.add(sa?'asc':'desc'); }
  filterTbl();
}

function renderTbl(){
  const sorted = [...filtered].sort((a,b)=>{
    const va=a[sk]??'', vb=b[sk]??'';
    return sa ? (va>vb?1:-1) : (va<vb?1:-1);
  });
  const total=sorted.length, pages=Math.ceil(total/PP)||1;
  const slice=sorted.slice((pg-1)*PP, pg*PP);
  document.getElementById('tinfo').textContent = `${total} reading${total!==1?'s':''}`;

  document.getElementById('tb').innerHTML = slice.map(r => {
    const sc  = r.isAlert ? 'ss-f' : 'ss-s';
    const si  = r.isAlert ? '⚠ Alert' : '✅ Normal';
    return `<tr>
      <td style="color:var(--muted)">${r.ts}</td>
      <td>${fmt(r.temp,1)}</td>
      <td>${fmt(r.hum,1)}</td>
      <td>${fmt(r.mq135,1)}</td>
      <td>${fmt(r.mq2,1)}</td>
      <td>${fmt(r.mq6,1)}</td>
      <td>${fmt(r.sound,1)}</td>
      <td><span class="ss ${sc}">${si}</span></td>
    </tr>`;
  }).join('');

  // Pagination
  const p = document.getElementById('pg'); p.innerHTML='';
  const prev = document.createElement('button');
  prev.className='pb'; prev.textContent='← Prev'; prev.disabled=pg<=1;
  prev.onclick=()=>{pg--;renderTbl()}; p.appendChild(prev);
  for(let i=1;i<=pages;i++){
    if(pages>7&&i!==1&&i!==pages&&Math.abs(i-pg)>2){
      if(Math.abs(i-pg)===3){const s=document.createElement('span');s.className='pb';s.textContent='…';s.style.cursor='default';p.appendChild(s);}
      continue;
    }
    const b=document.createElement('button');
    b.className='pb'+(i===pg?' ap':'');
    b.textContent=i;
    b.onclick=(()=>{const pi=i;return()=>{pg=pi;renderTbl()}})();
    p.appendChild(b);
  }
  const next=document.createElement('button');
  next.className='pb'; next.textContent='Next →'; next.disabled=pg>=pages;
  next.onclick=()=>{pg++;renderTbl()}; p.appendChild(next);
  const inf=document.createElement('span');
  inf.className='pgi'; inf.textContent=`Page ${pg} of ${pages}`;
  p.appendChild(inf);
}

// ══════════════════════════════════════════════
// 15. FIREBASE onValue() LISTENER
//     This is the single entry point for all live data.
//     Fires immediately on connect and on every change.
// ══════════════════════════════════════════════
setFbStatus('connecting', 'Connecting…');

db.ref('sensor/').on('value',
  snapshot => {
    // Successfully received data
    setFbStatus('connected', 'Connected');

    const raw = snapshot.val();
    if(!raw){
      console.warn('Firebase: sensor/ node is empty or null');
      return;
    }

    // Normalise keys — Firebase keys: hum, mq135, mq2, mq6, sound, temp
    const data = {
      temp:   raw.temp  != null ? parseFloat(raw.temp)  : null,
      hum:    raw.hum   != null ? parseFloat(raw.hum)   : null,
      mq135:  raw.mq135 != null ? parseFloat(raw.mq135) : null,
      mq2:    raw.mq2   != null ? parseFloat(raw.mq2)   : null,
      mq6:    raw.mq6   != null ? parseFloat(raw.mq6)   : null,
      sound:  raw.sound != null ? parseFloat(raw.sound) : null
    };

    console.log('🔥 Firebase update:', data);

    updateCount++;

    // Run all update functions in sequence
    updateCards(data);       // 1. Update sensor cards + bars + tags
    checkAlerts(data);       // 2. Check thresholds, show/hide alert items
    pushHistory(data);       // 3. Push to rolling 20-item buffer, update charts
    updateStats(data);       // 4. Update running session averages
    pushLog(data);           // 5. Append to live data log table
  },
  error => {
    // Firebase connection error
    console.error('Firebase error:', error);
    setFbStatus('error', 'Error: ' + error.code);
  }
);

// Monitor Firebase connection state
db.ref('.info/connected').on('value', snap => {
  if(snap.val() === false) setFbStatus('connecting', 'Reconnecting…');
});

// ══════════════════════════════════════════════
// 16. INIT — build charts section ready
//     (charts themselves built lazily on first tab click)
// ══════════════════════════════════════════════
// Initialize table filter with empty state
filtered = [...dataLog];
