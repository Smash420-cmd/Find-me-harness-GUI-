/**
 * The page shell (Task 9) — static HTML/CSS/JS, projection only (Law 4). The
 * client JS posts intent to /api/find and RENDERS the RunView the engine returns.
 * It contains no verification, ranking, or filtering — those are the engine's.
 */
export function renderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The Harness — find me RAM</title>
<style>
  :root { --bg:#0b0f14; --card:#141b22; --ink:#e6edf3; --muted:#8b98a5; --acc:#2ea043; --warn:#d29922; --line:#222c36; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif; }
  header { padding:22px 20px; border-bottom:1px solid var(--line); }
  h1 { margin:0; font-size:20px; } .sub { color:var(--muted); font-size:13px; margin-top:4px; }
  main { max-width:1100px; margin:0 auto; padding:20px; }
  .doors { display:flex; gap:8px; margin-bottom:14px; }
  .doors button { background:var(--card); color:var(--muted); border:1px solid var(--line); padding:8px 14px; border-radius:8px; cursor:pointer; }
  .doors button.active { color:var(--ink); border-color:var(--acc); }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
  input,select { width:100%; background:var(--bg); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px; }
  .row { display:flex; gap:10px; align-items:center; margin-top:14px; }
  .go { background:var(--acc); color:#04130a; border:none; font-weight:600; padding:10px 18px; border-radius:8px; cursor:pointer; }
  .go:disabled { opacity:.5; cursor:wait; }
  #status { color:var(--muted); font-size:13px; }
  .board { margin-top:22px; display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .result { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .result img { width:100%; display:block; border-bottom:1px solid var(--line); background:#fff; }
  .result .body { padding:12px; }
  .result .title { font-size:13px; line-height:1.35; }
  .result .price { font-size:22px; font-weight:700; margin:8px 0 4px; }
  .badge { display:inline-block; font-size:11px; padding:3px 8px; border-radius:999px; }
  .ok { background:rgba(46,160,67,.15); color:#3fb950; }
  .flag { background:rgba(210,153,34,.15); color:var(--warn); }
  .note { color:var(--muted); margin-top:16px; font-size:13px; }
  a.link { color:#58a6ff; text-decoration:none; font-size:12px; }
  .hidden { display:none; }
  #lightbox { display:none; position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:999; align-items:center; justify-content:center; cursor:zoom-out; }
  #lightbox.open { display:flex; }
  #lightbox img { max-width:92vw; max-height:92vh; border-radius:8px; box-shadow:0 8px 40px #000; }
  .result img { cursor:zoom-in; }
  /* Foil trading-card treatment: animated holographic border + glow. */
  @keyframes foil-shift { 0%{background-position:0 0,0% 50%} 50%{background-position:0 0,100% 50%} 100%{background-position:0 0,0% 50%} }
  @keyframes foil-glow-gold { 0%,100%{box-shadow:0 0 14px rgba(255,200,40,.45),0 0 42px rgba(255,170,0,.22)} 50%{box-shadow:0 0 22px rgba(255,215,80,.65),0 0 60px rgba(255,180,0,.32)} }
  @keyframes foil-glow-silver { 0%,100%{box-shadow:0 0 12px rgba(200,215,235,.4),0 0 36px rgba(160,180,205,.18)} 50%{box-shadow:0 0 20px rgba(230,240,255,.6),0 0 52px rgba(170,190,215,.28)} }
  /* Three stacked layers: moving light-sweep sheen, tinted metallic base
     (both padding-box = the card FACE), then the animated foil border. */
  @keyframes foil-shift-3 { 0%{background-position:0% 50%,0 0,0% 50%} 50%{background-position:100% 50%,0 0,100% 50%} 100%{background-position:0% 50%,0 0,0% 50%} }
  .result.winner {
    border:3px solid transparent;
    background:
      linear-gradient(115deg, rgba(255,215,0,.20), rgba(255,248,208,.06) 28%, rgba(255,179,0,.22) 48%, rgba(122,82,0,.05) 68%, rgba(255,242,168,.18)) padding-box,
      linear-gradient(150deg,#2b2312,#3a2f14 38%,#2c2410 62%,#191408) padding-box,
      linear-gradient(115deg,#7a5200,#ffd700,#fff8d0,#ffb300,#e3a008,#fff2a8,#7a5200) border-box;
    background-size:300% 300%,100% 100%,400% 400%;
    animation:foil-shift-3 4s ease-in-out infinite, foil-glow-gold 2.6s ease-in-out infinite;
    transform:scale(1.02);
  }
  .result.ai-pick {
    border:3px solid transparent;
    background:
      linear-gradient(115deg, rgba(223,233,245,.18), rgba(255,255,255,.05) 28%, rgba(159,178,200,.22) 48%, rgba(30,40,52,.05) 68%, rgba(238,245,255,.16)) padding-box,
      linear-gradient(150deg,#202b38,#2b3a4a 38%,#22303e 62%,#161d26) padding-box,
      linear-gradient(115deg,#5c6a7a,#dfe9f5,#ffffff,#9fb2c8,#7f8fa3,#eef5ff,#5c6a7a) border-box;
    background-size:300% 300%,100% 100%,400% 400%;
    animation:foil-shift-3 5s ease-in-out infinite, foil-glow-silver 3s ease-in-out infinite;
    transform:scale(1.01);
  }
  .result.winner .ai-pick-panel, .result.ai-pick .ai-pick-panel { background:rgba(10,14,18,.45); }
  .result.unc { opacity:.78; border-style:dashed; }
  .winner-badge { display:inline-block; font-size:11px; font-weight:800; color:#1a1200; background:linear-gradient(115deg,#ffd700,#fff3b0,#ffb300,#ffd700); background-size:300% 300%; animation:foil-shift 3s linear infinite; padding:3px 10px; border-radius:999px; margin-left:6px; letter-spacing:.04em; text-transform:uppercase; }
  .ai-pick-panel { margin-top:10px; padding:9px 11px; background:rgba(139,152,165,.07); border:1px solid rgba(139,152,165,.22); border-radius:8px; }
  .ai-pick-panel .ai-star-line { font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; background:linear-gradient(115deg,#dfe9f5,#ffffff,#9fb2c8,#eef5ff); background-size:300% 300%; animation:foil-shift 3.5s linear infinite; -webkit-background-clip:text; background-clip:text; color:transparent; }
  .ai-pick-panel .ai-reason { font-size:11px; color:#8b98a5; margin-top:3px; line-height:1.45; }
  .conv-thread { min-height:80px; max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
  .msg { max-width:80%; padding:8px 12px; border-radius:12px; font-size:13px; line-height:1.45; word-break:break-word; }
  .msg.user { align-self:flex-end; background:var(--acc); color:#04130a; border-bottom-right-radius:3px; }
  .msg.assistant { align-self:flex-start; background:var(--card); border:1px solid var(--line); color:var(--ink); border-bottom-left-radius:3px; }
  .conv-input-row { display:flex; gap:8px; }
  .conv-input-row input { flex:1; }
  .send { background:var(--acc); color:#04130a; border:none; font-weight:600; padding:8px 16px; border-radius:8px; cursor:pointer; white-space:nowrap; }
  #settings-bar { display:none; padding:8px 20px; background:var(--card); border-bottom:1px solid var(--line); align-items:center; gap:10px; }
  #settings-bar.open { display:flex; }
  #settings-bar label { font-size:12px; color:var(--muted); white-space:nowrap; margin:0; }
  #settings-bar input { max-width:340px; font-family:monospace; font-size:12px; }
  #settings-bar .save { background:var(--acc); color:#04130a; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; }
  .gear { background:none; border:none; color:var(--muted); cursor:pointer; font-size:17px; padding:0 0 0 12px; line-height:1; }
  .stock-ok { color:#3fb950; } .stock-no { color:var(--warn); }
  #scan-debug { font-size:11px; color:var(--muted); margin-top:6px; min-height:16px; }
</style>
</head>
<body>
<div id="lightbox" onclick="this.classList.remove('open')"><img id="lightbox-img" src="" alt="proof-shot enlarged"/></div>
<header style="display:flex;align-items:flex-start;justify-content:space-between">
  <div>
    <h1>The Harness — <span style="color:var(--acc)">find me RAM</span></h1>
    <div class="sub">AI proposes, the engine disposes. Every card carries a live proof-shot. No ghost inventory.</div>
  </div>
  <button class="gear" onclick="toggleSettings()" title="API key settings">⚙</button>
</header>
<div id="settings-bar">
  <label for="api-key-input">Anthropic API key (stored locally, never sent off-device)</label>
  <input id="api-key-input" type="password" placeholder="sk-ant-..." autocomplete="off"/>
  <button class="save" onclick="saveKey()">Save</button>
  <button class="save" style="background:var(--card);color:var(--muted);border:1px solid var(--line)" onclick="clearKey()">Clear</button>
</div>
<main>
  <div class="doors">
    <button id="door-structured" class="active" onclick="setDoor('structured')">Structured</button>
    <button id="door-conversational" onclick="setDoor('conversational')">Conversational</button>
  </div>

  <div id="panel-structured" class="panel">
    <div class="grid">
      <div><label>Generation <span style="color:var(--acc)">*</span></label><select id="generation" onchange="updateAll()"><option>DDR5</option><option>DDR4</option></select></div>
      <div><label>Total capacity <span style="color:var(--acc)">*</span></label><select id="capacityGb" onchange="updateKits()"></select></div>
      <div><label>Kit config</label><select id="kitConfig"></select></div>
      <div><label>Speed (MT/s)</label><select id="dataRateMtps"></select></div>
      <div><label>Max CL</label><select id="casLatency"><option value="">Any</option></select></div>
      <div><label>Type</label><select id="formFactor"><option value="dimm">Desktop</option><option value="sodimm">Laptop (SO-DIMM)</option></select></div>
      <div><label>Brand</label><select id="brand"><option value="">Any</option><option value="kingston">Kingston</option><option value="corsair">Corsair</option><option value="gskill">G.Skill</option><option value="crucial">Crucial</option><option value="teamgroup">TeamGroup</option><option value="adata">ADATA</option><option value="patriot">Patriot</option></select></div>
      <div><label>Budget AUD</label><select id="budgetAud"><option value="">No limit</option></select></div>
    </div>
  </div>

  <div id="panel-conversational" class="panel hidden">
    <div id="conv-thread" class="conv-thread"></div>
    <div class="conv-input-row">
      <input id="conv-input" placeholder="e.g. I need RAM for my new PC build" onkeydown="if(event.key==='Enter')convSend()"/>
      <button class="send" onclick="convSend()">Send</button>
    </div>
  </div>

  <div class="row">
    <button id="go" class="go" onclick="find()">Find me RAM</button>
    <button id="find-more" class="go" style="display:none;background:var(--card);color:var(--ink);border:1px solid var(--line);font-weight:500" onclick="findMore()">Find More</button>
    <span id="status"></span>
  </div>

  <div id="conv-warning" style="display:none;margin-top:12px;padding:10px 14px;background:rgba(210,153,34,.12);border:1px solid var(--warn);border-radius:8px;color:var(--warn);font-size:13px"></div>
  <div id="scan-debug"></div>
  <div id="board" class="board"></div>
  <div id="unc-wrap" style="display:none;margin-top:26px">
    <div style="font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px;margin-bottom:10px">
      RAM we found but couldn't confirm is this exact product — check these yourself:
    </div>
    <div id="unconfirmed" class="board"></div>
  </div>
  <div id="note" class="note"></div>
</main>

<script>
function enlarge(src){document.getElementById('lightbox-img').src=src;document.getElementById('lightbox').classList.add('open');}
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('lightbox').classList.remove('open');});

// Settings: API key stored in localStorage, sent as header so the server can use the user's own Anthropic account.
function toggleSettings(){document.getElementById('settings-bar').classList.toggle('open');}
function saveKey(){const k=document.getElementById('api-key-input').value.trim();if(k){localStorage.setItem('anthropic-key',k);alert('Key saved.');}else clearKey();}
function clearKey(){localStorage.removeItem('anthropic-key');document.getElementById('api-key-input').value='';alert('Key cleared.');}
function apiHeaders(extra){const h={'content-type':'application/json',...extra};const k=localStorage.getItem('anthropic-key');if(k)h['x-anthropic-api-key']=k;return h;}
(function initKey(){const k=localStorage.getItem('anthropic-key');if(k)document.getElementById('api-key-input').value=k;})();

const SPEEDS={DDR5:[4800,5200,5600,6000,6400,6800,7200,7600,8000],DDR4:[2133,2400,2666,3000,3200,3600,4000,4266,4400,4800]};
const CL_RANGES={DDR5:[28,30,32,34,36,38,40,42,44,46,48,50,52,54,56],DDR4:[14,15,16,17,18,19,20,22,24,26,28,30]};
const CAPS={DDR5:[8,16,24,32,48,64,96,128],DDR4:[8,16,32,64,128]};
const KITS={8:[{k:1,s:8},{k:2,s:4}],16:[{k:1,s:16},{k:2,s:8},{k:4,s:4}],24:[{k:1,s:24},{k:2,s:12}],32:[{k:1,s:32},{k:2,s:16},{k:4,s:8}],48:[{k:2,s:24},{k:4,s:12}],64:[{k:1,s:64},{k:2,s:32},{k:4,s:16}],96:[{k:4,s:24},{k:2,s:48}],128:[{k:2,s:64},{k:4,s:32}]};
const DEFAULT_CAP={DDR5:32,DDR4:32};

function updateAll(){
  const gen=document.getElementById('generation').value;
  // speeds
  const spd=document.getElementById('dataRateMtps');
  spd.innerHTML='<option value="">Any speed</option>'+SPEEDS[gen].map(s=>'<option value="'+s+'">'+s+' MT/s</option>').join('');
  // CL options
  const cl=document.getElementById('casLatency');
  cl.innerHTML='<option value="">Any</option>'+CL_RANGES[gen].map(c=>'<option value="'+c+'">CL'+c+'</option>').join('');
  // capacities — DDR4 has no 24GB sticks
  const cap=document.getElementById('capacityGb');
  const prev=Number(cap.value);
  const caps=CAPS[gen];
  cap.innerHTML=caps.map(c=>'<option value="'+c+'">'+c+' GB</option>').join('');
  cap.value=String(caps.includes(prev)?prev:DEFAULT_CAP[gen]);
  updateKits();
}
function updateKits(){
  const cap=Number(document.getElementById('capacityGb').value);
  const sel=document.getElementById('kitConfig');
  sel.innerHTML='<option value="">Any config</option>'+
    (KITS[cap]||[]).map(({k,s})=>'<option value="'+k+'x'+s+'">'+k+'×'+s+'GB</option>').join('');
}
(function initBudget(){
  const sel=document.getElementById('budgetAud');
  for(let v=50;v<=500;v+=50)   sel.innerHTML+='<option value="'+v+'">$'+v+'</option>';
  for(let v=600;v<=2000;v+=100) sel.innerHTML+='<option value="'+v+'">$'+v+'</option>';
  for(let v=2500;v<=5000;v+=500) sel.innerHTML+='<option value="'+v+'">$'+v+'</option>';
})();
updateAll();

let door='structured';
let convTurns=[];
let convRound=0;
const CONV_MAX_ROUNDS=3;

function setDoor(d){door=d;
  for(const x of['structured','conversational']){
    document.getElementById('door-'+x).classList.toggle('active',x===d);
    document.getElementById('panel-'+x).classList.toggle('hidden',x!==d);
    document.getElementById('go').style.display=d==='conversational'?'none':'';
  }
  if(d==='conversational') resetConv();
}

function resetConv(){
  convTurns=[]; convRound=0;
  document.getElementById('conv-thread').innerHTML='';
  document.getElementById('conv-input').value='';
  document.getElementById('conv-input').disabled=false;
}

function addMsg(role,text){
  const el=document.createElement('div');
  el.className='msg '+role;
  el.textContent=text;
  const thread=document.getElementById('conv-thread');
  thread.appendChild(el);
  thread.scrollTop=thread.scrollHeight;
}

async function convSend(){
  const input=document.getElementById('conv-input');
  const text=input.value.trim();
  if(!text) return;
  input.value=''; input.disabled=true;
  addMsg('user',text);

  if(convTurns.length===0){
    convTurns=[{role:'user',content:text}];
  } else {
    convTurns.push({role:'user',content:text});
  }

  if(convRound>=CONV_MAX_ROUNDS){
    convTurns.push({role:'user',content:'[triage cap reached — please propose with best-effort defaults]'});
  }

  const status=document.getElementById('status');
  status.textContent='Thinking…';
  const convTimer=startTimer(status,'Thinking…');
  try{
    // Use streaming even for conversational — server sends {type:'clarify'} or streams results
    clearInterval(convTimer);
    addMsg('assistant','Got it — searching now…');
    const ev=await runStream({door:'conversational',turns:convTurns});
    if(ev&&ev.type==='clarify'&&convRound<CONV_MAX_ROUNDS){
      convRound++;
      convTurns.push({role:'assistant',content:ev.question});
      addMsg('assistant',ev.question);
      status.textContent='';
      input.disabled=false; input.focus();
      return;
    }
    if(ev&&ev.convNote) convTurns.push({role:'assistant',content:ev.convNote});
  }catch(e){addMsg('assistant','Error: '+e.message); status.textContent='';}
  input.disabled=false;
}

const _cardData=[];
let _currentDoor='';
function addCard(r){
  const board=document.getElementById('board');
  const idx=_cardData.length; _cardData.push(r);
  const el=document.createElement('div'); el.className='result'; el.dataset.key=r.url;
  const proof=r.proofUrl
    ?'<img src="'+r.proofUrl+'" alt="proof-shot" title="Click to enlarge" style="cursor:zoom-in" onclick="enlarge(this.src)"/>'
    :'';
  const stockClass=r.availability==='in_stock'?'stock-ok':r.availability==='out_of_stock'?'stock-no':'';
  el.innerHTML=
    proof+
    '<div class="body">'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:2px">'+r.retailer+'</div>'+
      '<div class="title">'+r.title+'</div>'+
      '<div class="price">'+r.priceLabel+'</div>'+
      '<span class="badge '+(r.flagged?'flag':'ok')+' '+stockClass+'">'+r.honestLabel+'</span>'+
      '<div style="margin-top:8px;display:flex;align-items:center;gap:10px">'+
        '<a class="link" href="'+r.url+'" target="_blank" rel="noopener">view →</a>'+
        (_currentDoor==='deepsearch'?'':'<button class="link" style="background:none;border:none;cursor:pointer;font-size:12px;color:#58a6ff;padding:0" onclick="findBestPrice('+idx+')">find best price →</button>')+
      '</div>'+
    '</div>';
  board.appendChild(el);
}

function addUnconfirmedCard(r){
  const wrap=document.getElementById('unc-wrap');
  const box=document.getElementById('unconfirmed');
  if([...box.children].some(el=>el.dataset.key===r.url)) return;
  const el=document.createElement('div'); el.className='result unc'; el.dataset.key=r.url;
  el.innerHTML=
    '<div class="body">'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:2px">'+r.retailer+'</div>'+
      '<div class="title">'+r.title+'</div>'+
      '<div class="price">'+r.priceLabel+'</div>'+
      '<span class="badge flag">Couldn\\u2019t confirm \\u2014 check yourself</span>'+
      '<div style="margin-top:8px"><a class="link" href="'+r.url+'" target="_blank" rel="noopener">view →</a></div>'+
    '</div>';
  box.appendChild(el);
  wrap.style.display='';
}

function reorderBoard(order){
  const board=document.getElementById('board');
  const cards=Object.fromEntries([...board.children].map(el=>[el.dataset.key||'',el]));
  order.forEach(key=>{if(cards[key])board.appendChild(cards[key]);});
}

function findBestPrice(idx){
  const r=_cardData[idx]; if(!r) return;
  if(document.getElementById('go').disabled) return; // search already running
  runStream({door:'deepsearch',title:r.title,fields:lastFields});
}

async function requestAiPick(board){
  // Clear any previous AI pick across ALL cards (covers find-more re-anoint)
  [...board.children].forEach(el=>{
    el.classList.remove('ai-pick');
    el.querySelector('.ai-pick-panel')?.remove();
  });
  const boardKeys=new Set([...board.children].map(el=>el.dataset.key));
  const picks=_cardData
    .filter(r=>boardKeys.has(r.url))
    .map(r=>({key:r.url,title:r.title,retailer:r.retailer,priceLabel:r.priceLabel,priceAud:r.priceAud}));
  if(picks.length===0) return;
  try{
    const res=await fetch('/api/recommend',{method:'POST',headers:apiHeaders(),body:JSON.stringify({picks})});
    if(!res.ok) return;
    const data=await res.json();
    if(!data.key) return;
    const card=[...board.children].find(el=>el.dataset.key===data.key);
    if(!card) return;
    card.classList.add('ai-pick');
    const panel=document.createElement('div'); panel.className='ai-pick-panel';
    panel.innerHTML='<div class="ai-star-line">★ AI Recommendation</div><div class="ai-reason">'+data.reason+'</div>';
    card.querySelector('.body').appendChild(panel);
  }catch{}
}

function runWithData(data){
  // Legacy path — receives a complete result set (used by conversational once spec is ready)
  const note=document.getElementById('note');
  const warn=document.getElementById('conv-warning');
  if(data.convNote){warn.textContent='⚠ '+data.convNote; warn.style.display='';}
  document.getElementById('status').textContent='Done in '+data.iterations+' pass(es).';
  note.textContent=data.note||'';
  for(const r of (data.results||[])) addCard(r);
  if(data.order) reorderBoard(data.order);
}

function startTimer(status,base){
  let s=0;
  const t=setInterval(()=>{s++;status.textContent=base+' ('+s+'s)';},1000);
  return t;
}

// Parse SSE chunks from a ReadableStream — yields parsed JSON objects
async function* readSSE(body){
  const reader=body.getReader();
  const dec=new TextDecoder();
  let buf='';
  while(true){
    const {done,value}=await reader.read();
    if(done) break;
    buf+=dec.decode(value,{stream:true});
    let idx;
    while((idx=buf.indexOf('\\n\\n'))>=0){
      const chunk=buf.slice(0,idx).trim();
      buf=buf.slice(idx+2);
      if(chunk.startsWith('data: ')){
        try{yield JSON.parse(chunk.slice(6));}catch{}
      }
    }
  }
}

let lastFields=null;

async function runStream(postBody,append=false){
  _currentDoor=postBody.door||'';
  const go=document.getElementById('go'),status=document.getElementById('status');
  const board=document.getElementById('board'),note=document.getElementById('note');
  const debug=document.getElementById('scan-debug');
  const fm=document.getElementById('find-more');
  if(!append){
    board.innerHTML=''; note.textContent=''; debug.textContent='';
    document.getElementById('unconfirmed').innerHTML='';
    document.getElementById('unc-wrap').style.display='none';
    fm.style.display='none'; fm.disabled=false; fm.textContent='Find More';
    const warn=document.getElementById('conv-warning');
    warn.style.display='none';
  }
  go.disabled=true; fm.style.display='none';
  status.textContent=postBody.door==='deepsearch'?'Deep searching for best price…':'Scanning…';
  const timer=startTimer(status,'Scanning…');
  let found=0;
  try{
    const res=await fetch('/api/scan',{method:'POST',headers:apiHeaders(),body:JSON.stringify(postBody)});
    if(!res.ok||!res.body){clearInterval(timer);status.textContent='✗ Server error '+res.status;go.disabled=false;return null;}
    for await(const ev of readSSE(res.body)){
      if(ev.type==='clarify') return ev;
      if(ev.type==='status'){debug.textContent=ev.message;}
      if(ev.type==='error'){clearInterval(timer);status.textContent='✗ '+ev.message;break;}
      if(ev.type==='result'){found++;status.textContent=found+' result'+(found>1?'s':'')+' found…';addCard(ev);}
      if(ev.type==='unconfirmed'){addUnconfirmedCard(ev);}
      if(ev.type==='done'){
        clearInterval(timer);
        if(ev.convNote){const warn=document.getElementById('conv-warning');warn.textContent='⚠ '+ev.convNote;warn.style.display='';}
        note.textContent=ev.note||'';
        const total=[...board.children].length;
        if(total===0){status.textContent='No results found.';}
        else if(postBody.door==='deepsearch'){status.textContent=total+' result'+(total>1?'s':'')+' — sorted cheapest first.';}
        else if(ev.hasBudget){status.textContent=total+' option'+(total>1?'s':'')+' within budget — sorted by price.';}
        else{status.textContent=total+' option'+(total>1?'s':'')+' found across retailers.';}
        debug.textContent='';
        if(ev.order) reorderBoard(ev.order);
        if(postBody.door==='deepsearch'){
          // Deepsearch: gold crown on cheapest card
          [...board.children].forEach((el,i)=>{
            el.classList.toggle('winner',i===0&&total>0);
            el.querySelector('.winner-badge')?.remove();
            if(i===0&&total>0){
              const badge=document.createElement('span');
              badge.className='winner-badge'; badge.textContent='Best Price';
              el.querySelector('.price')?.after(badge);
            }
          });
        }else if(total>0){
          // Regular scan / find-more: AI anoints the winner (async, cards already visible)
          requestAiPick(board);
        }
        // Show Find More or Search Exhausted
        if(ev.exhausted){fm.textContent='Search Exhausted';fm.disabled=true;}
        else{fm.textContent='Find More';fm.disabled=false;}
        fm.style.display='';
        return ev;
      }
    }
  }catch(e){clearInterval(timer);status.textContent='✗ '+e.message;}
  go.disabled=false;
  return null;
}

async function find(){
  const go=document.getElementById('go');
  const kitVal=document.getElementById('kitConfig').value;
  const [kitCount,perStickGb]=kitVal?kitVal.split('x').map(Number):[undefined,undefined];
  const brand=document.getElementById('brand').value;
  const budgetRaw=document.getElementById('budgetAud').value;
  const clRaw=document.getElementById('casLatency').value;
  lastFields={
    generation:document.getElementById('generation').value,
    capacityGb:Number(document.getElementById('capacityGb').value),
    ...(document.getElementById('dataRateMtps').value?{dataRateMtps:Number(document.getElementById('dataRateMtps').value)}:{}),
    ...(clRaw?{casLatency:Number(clRaw)}:{}),
    ...(kitCount?{kitCount,perStickGb}:{}),
    ...(budgetRaw?{budgetAud:Number(budgetRaw)}:{}),
    ...(brand?{constraints:{brandInclude:[brand],formFactor:document.getElementById('formFactor').value}}:{constraints:{formFactor:document.getElementById('formFactor').value}}),
  };
  await runStream({door:'structured',fields:lastFields});
  go.disabled=false;
}

async function findMore(){
  if(!lastFields) return;
  const go=document.getElementById('go');
  const excludeKeys=[...document.getElementById('board').children].map(el=>el.dataset.key).filter(Boolean);
  await runStream({door:'structured',fields:lastFields,exclude:excludeKeys},true);
  go.disabled=false;
}
</script>
</body>
</html>`;
}
