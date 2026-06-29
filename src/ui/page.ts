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
</style>
</head>
<body>
<header>
  <h1>The Harness — <span style="color:var(--acc)">find me RAM</span></h1>
  <div class="sub">AI proposes, the engine disposes. Every card carries a live proof-shot. No ghost inventory.</div>
</header>
<main>
  <div class="doors">
    <button id="door-structured" class="active" onclick="setDoor('structured')">Structured</button>
    <button id="door-conversational" onclick="setDoor('conversational')">Conversational</button>
  </div>

  <div id="panel-structured" class="panel">
    <div class="grid">
      <div><label>Generation</label><select id="generation"><option>DDR5</option><option>DDR4</option></select></div>
      <div><label>Total capacity (GB)</label><input id="capacityGb" type="number" value="32"/></div>
      <div><label>Kit count</label><input id="kitCount" type="number" value="2"/></div>
      <div><label>Per stick (GB)</label><input id="perStickGb" type="number" value="16"/></div>
      <div><label>Speed (MT/s)</label><input id="dataRateMtps" type="number" value="6000"/></div>
      <div><label>CAS latency (optional)</label><input id="casLatency" type="number" placeholder="e.g. 30"/></div>
      <div><label>Budget AUD (optional)</label><input id="budgetAud" type="number" placeholder="e.g. 800"/></div>
    </div>
  </div>

  <div id="panel-conversational" class="panel hidden">
    <label>Describe what you want</label>
    <input id="text" placeholder="fast 32gb DDR5-6000 2x16 for a 7800X3D build under \$800"/>
  </div>

  <div class="row">
    <button id="go" class="go" onclick="find()">Find me RAM</button>
    <span id="status"></span>
  </div>

  <div id="board" class="board"></div>
  <div id="note" class="note"></div>
</main>

<script>
let door = 'structured';
function setDoor(d){ door=d;
  for (const x of ['structured','conversational']){
    document.getElementById('door-'+x).classList.toggle('active', x===d);
    document.getElementById('panel-'+x).classList.toggle('hidden', x!==d);
  }
}
function numOrU(id){ const v=document.getElementById(id).value; return v===''?undefined:Number(v); }
async function find(){
  const go=document.getElementById('go'), status=document.getElementById('status');
  const board=document.getElementById('board'), note=document.getElementById('note');
  board.innerHTML=''; note.textContent=''; go.disabled=true; status.textContent='Converging → observing Umart → verifying with live proof-shots…';
  let payload;
  if (door==='structured'){
    payload={ door:'structured', fields:{
      generation:document.getElementById('generation').value,
      capacityGb:numOrU('capacityGb'), kitCount:numOrU('kitCount'), perStickGb:numOrU('perStickGb'),
      dataRateMtps:numOrU('dataRateMtps'), casLatency:numOrU('casLatency'), budgetAud:numOrU('budgetAud') }};
  } else { payload={ door:'conversational', text:document.getElementById('text').value }; }
  try {
    const res = await fetch('/api/find',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data = await res.json();
    if (data.error){ status.textContent='✗ '+data.error; go.disabled=false; return; }
    if (data.clarify){ status.textContent='? '+data.clarify; go.disabled=false; return; }
    status.textContent = 'Done in '+data.iterations+' pass(es).';
    note.textContent = data.note;
    for (const r of data.results){
      const el=document.createElement('div'); el.className='result';
      el.innerHTML =
        '<img src="'+r.proofUrl+'" alt="proof-shot"/>'+
        '<div class="body">'+
          '<div class="title">'+r.title+'</div>'+
          '<div class="price">'+r.priceLabel+'</div>'+
          '<span class="badge '+(r.flagged?'flag':'ok')+'">'+r.confidencePct+'% · '+r.honestLabel+'</span>'+
          '<div style="margin-top:8px"><a class="link" href="'+r.url+'" target="_blank" rel="noopener">view on Umart →</a></div>'+
        '</div>';
      board.appendChild(el);
    }
  } catch(e){ status.textContent='✗ '+e.message; }
  go.disabled=false;
}
</script>
</body>
</html>`;
}
