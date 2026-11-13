/* ===========================================================================
   TenderLens — app logic
   Pure vanilla JS, no build step. Reads the global LEADS (from data.js) and
   renders two views: the leads list and a lead detail page.
   =========================================================================== */

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fitColor=f=>f>=80?"var(--good)":f>=70?"var(--accent)":f>=60?"var(--warn)":"var(--bad)";
function daysLeft(d){const now=new Date();const t=new Date(d+"T12:00:00");return Math.ceil((t-now)/86400000);}
function deadlineClass(d){const n=daysLeft(d);return n<=4?"soon":n<=14?"mid":"far";}
function fmtDate(d){return new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
const nz=v=>v==null||v===""?"Not stated":v;
const isOpen=l=>!!l.deadline&&daysLeft(l.deadline)>=0;
/* Deadline pill text + class. Real leads may have no deadline (e.g. only a result is published) or a `stage`. */
function deadlineInfo(l){
  if(!isOpen(l))return {cls:"closed",txt:l.stage||"Closed"};
  const n=daysLeft(l.deadline);
  return {cls:deadlineClass(l.deadline),txt:n===0?"Closes today":n===1?"1 day left":n+" days left"};
}
function proofBadge(l){
  return l.verified
    ? `<span class="ver-badge" title="Details read from the official notice on ${fmtDate(l.verified)}">Verified</span>`
    : `<span class="sample-badge" title="Illustrative sample, not a real tender">Sample</span>`;
}

const ELIG={
  meets:{t:"You meet the stated criteria",c:"good",flag:""},
  partner:{t:"Bid with a partner",c:"warn",flag:"Partner needed"},
  gap:{t:"Eligibility gap",c:"bad",flag:"Eligibility gap"},
};
const YOU={meets:"Meets",gap:"Gap",check:"Check"};

let activeFilter="all";
let activeVertical="all";
let activeCost="all";
let useExemption=true;   // count EMD as waived where the tender allows it and Udyam is ticked
let query="";

/* ---------- cost to bid ----------
   l.fees = { cur?, doc?, portal?, bid?, perf? } — see CLAUDE.md. A missing item
   means "not stated"; amount 0 means the notice says nil. Only doc/portal/bid
   are paid before award; perf (performance security) applies only if you win. */
const COST={
  free:{t:"Free to bid",c:"good"},
  deposit:{t:"Refundable deposit only",c:"muted"},
  fee:{t:"Fee to bid",c:"warn"},
  unstated:{t:"Cost not stated",c:"faint"},
};
const isIndia=l=>INDIA_PORTALS.includes(l.portal);
const bidLabel=l=>isIndia(l)?"EMD (bid security)":"Bid bond / tender guarantee";
function fmtMoney(n,cur){
  if(cur==null||cur==="INR"){
    if(n>=1e7)return "₹"+(+(n/1e7).toFixed(2))+" crore";
    if(n>=1e5)return "₹"+(+(n/1e5).toFixed(2))+" lakh";
    return "₹"+n.toLocaleString("en-IN");
  }
  try{return n.toLocaleString("en-GB",{style:"currency",currency:cur,maximumFractionDigits:0});}catch(e){return cur+" "+n;}
}
/* Is the EMD waived for this company? Needs the tender to allow it and Udyam ticked in readiness. */
const exemptForYou=it=>!!it&&it.exempt==="allowed"&&!!(READY.udyam&&READY.udyam.done);
/* amount after exemptions; null = stated but not a fixed number (e.g. a %) */
function effAmount(it){if(!it)return undefined;if(useExemption&&exemptForYou(it))return 0;return it.amount;}
function costOf(l){
  const f=l.fees||{},doc=effAmount(f.doc),portal=effAmount(f.portal),bid=effAmount(f.bid);
  const paid=v=>v===null||v>0;
  const fee=(paid(doc)?(doc||0):0)+(paid(portal)?(portal||0):0);
  let cls;
  if(paid(doc)||paid(portal))cls="fee";
  else if(doc===undefined||bid===undefined)cls="unstated";
  else cls=paid(bid)?"deposit":"free";
  return {cls,fee,deposit:paid(bid)?(bid||0):0,cur:f.cur};
}
function costChip(l){
  const c=costOf(l);
  if(c.cls==="fee")return `<span class="cchip warn" title="Non-refundable fee to take part">Fee ${c.fee?esc(fmtMoney(c.fee,c.cur)):"applies"}</span>`;
  if(c.deposit&&c.cls!=="free")return `<span class="cchip muted" title="Refundable bid security">${isIndia(l)?"EMD":"Bid bond"} ${esc(fmtMoney(c.deposit,c.cur))}</span>`;
  if(c.cls==="free")return `<span class="cchip good" title="No fee or deposit stated">Free to bid</span>`;
  return "";
}

/* ---------- list view ---------- */
function renderList(){
  const v=$("#listView");
  const sources=["all",...Array.from(new Set(LEADS.map(l=>l.source)))];
  const verticals=["all",...Array.from(new Set(LEADS.map(l=>l.vertical)))];
  let items=LEADS.filter(l=>(activeFilter==="all"||l.source===activeFilter)&&(activeVertical==="all"||l.vertical===activeVertical)&&(activeCost==="all"||costOf(l).cls===activeCost));
  const costN=k=>LEADS.filter(l=>costOf(l).cls===k).length;
  const udyam=!!(READY.udyam&&READY.udyam.done);
  if(query){const q=query.toLowerCase();items=items.filter(l=>(l.title+l.buyer+l.sector+l.source+l.vertical+(l.keywords||[]).join(" ")).toLowerCase().includes(q));}
  items=items.slice().sort((a,b)=>(isOpen(b)-isOpen(a))||(b.fit-a.fit));

  v.innerHTML=`
    <div class="page-head">
      <div><h1>My leads</h1><p>${items.length} of ${LEADS.length} opportunities shown · open first, then by fit score</p></div>
      <div class="toolbar">
        <div class="search">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="searchInput" type="search" placeholder="Quick find — buyer, service, sector…" value="${esc(query)}">
        </div>
      </div>
    </div>
    <div class="chipbar">
      <span class="chip-label">Category</span>
      ${verticals.map(s=>`<button class="chip ${s===activeVertical?"active":""}" data-vert="${esc(s)}">${s==="all"?"All categories":esc(s)}</button>`).join("")}
    </div>
    <div class="chipbar">
      <span class="chip-label">Source</span>
      ${sources.map(s=>`<button class="chip ${s===activeFilter?"active":""}" data-src="${esc(s)}">${s==="all"?"All sources":esc(s)}</button>`).join("")}
    </div>
    <div class="chipbar">
      <span class="chip-label">Cost to bid</span>
      <button class="chip ${activeCost==="all"?"active":""}" data-cost="all">Any cost</button>
      ${Object.keys(COST).map(k=>`<button class="chip ${k===activeCost?"active":""}" data-cost="${k}">${COST[k].t} <span class="chip-n">${costN(k)}</span></button>`).join("")}
      <label class="chip-toggle" title="${udyam?"Treat the EMD as waived where the tender allows an MSE/startup exemption":"Tick your Udyam (MSE) certificate in Bid readiness to use this"}">
        <input type="checkbox" id="exemptToggle" ${useExemption&&udyam?"checked":""} ${udyam?"":"disabled"}> Count my MSE exemption
      </label>
    </div>
    <div class="leads">
      ${items.map(l=>leadCard(l)).join("")||`<div class="card">No leads match that search.</div>`}
    </div>
    <p class="disclaimer">TenderLens surfaces published opportunities and an AI-assisted fit score. The fit score indicates relevance to your profile — not a probability of winning. Always confirm details against the official notice.</p>
  `;
  $("#searchInput").addEventListener("input",e=>{query=e.target.value;const c=e.target.selectionStart;renderList();const ni=$("#searchInput");ni.focus();ni.setSelectionRange(c,c);});
  v.querySelectorAll(".chip[data-src]").forEach(c=>c.addEventListener("click",()=>{activeFilter=c.dataset.src;renderList();}));
  v.querySelectorAll(".chip[data-vert]").forEach(c=>c.addEventListener("click",()=>{activeVertical=c.dataset.vert;renderList();}));
  v.querySelectorAll(".chip[data-cost]").forEach(c=>c.addEventListener("click",()=>{activeCost=c.dataset.cost;renderList();}));
  const et=$("#exemptToggle");if(et)et.addEventListener("change",()=>{useExemption=et.checked;renderList();});
  v.querySelectorAll(".lead").forEach(el=>el.addEventListener("click",()=>openDetail(el.dataset.id)));
}
function leadCard(l){
  const di=deadlineInfo(l);
  return `<button class="lead" data-id="${esc(l.id)}">
    <div class="fit-mini">
      <span class="val" style="color:${fitColor(l.fit)}">${l.fit}</span>
      <div class="fit-bar"><i style="width:${l.fit}%;background:${fitColor(l.fit)}"></i></div>
      <span class="cap">fit</span>
    </div>
    <div class="mid">
      <div class="toprow">
        <span class="id-badge">${esc(l.id)}</span>
        ${proofBadge(l)}
        <span class="type-badge">${esc(l.type)}</span>
        <span class="src-badge">${esc(l.source)}</span>
        ${l.qna&&l.qna.window.status==="open"?`<span class="qna-flag">Q&amp;A open</span>`:``}
        ${changeFlag(l)}
        ${l.eligibility&&l.eligibility.verdict&&ELIG[l.eligibility.verdict.status].flag?`<span class="elig-flag ${l.eligibility.verdict.status}">${ELIG[l.eligibility.verdict.status].flag}</span>`:``}
      </div>
      <h3>${esc(l.title)}</h3>
      <div class="meta"><span>${esc(l.buyer)}</span><span class="dot"></span><span>${esc(l.sector)}</span><span class="dot"></span><span>${esc(l.location)}</span><span class="dot"></span><span>${esc(l.vertical)}</span></div>
    </div>
    <div class="right">
      <span class="deadline-pill ${di.cls}">${esc(di.txt)}</span>
      ${l.deadline?`<span style="font-size:12px;color:var(--faint)">Due ${fmtDate(l.deadline)}</span>`:``}
      ${readyChip(l)}
      ${costChip(l)}
    </div>
  </button>`;
}

/* ---------- bid readiness ----------
   Company-wide state (READINESS_ITEMS in guides.js, DEMO_READINESS in data.js),
   overlaid with the viewer's own ticks saved in this browser. */
const RKEY="tl-readiness";
function loadReady(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(RKEY)||"{}")||{};}catch(e){}
  const out={};READINESS_ITEMS.forEach(it=>{out[it.key]=Object.assign({done:false},DEMO_READINESS[it.key],saved[it.key]);});
  return out;
}
let READY=loadReady();
function saveReady(){try{localStorage.setItem(RKEY,JSON.stringify(READY));}catch(e){}}
const RITEM=k=>READINESS_ITEMS.find(i=>i.key===k);
const INDIA_PORTALS=["cppp","cppp-cpse","gem","buyer"];
/* Which items this tender needs: from its portal, plus certifications and EMD exemption mentioned in its notice. */
function tenderNeeds(l){
  const base={"cppp":["dsc","acct-cppp"],"cppp-cpse":["dsc","acct-cpse"],"gem":["acct-gem"],"uk":["uk-cdp"],"eu":["espd"],"us":["us-vendor"]}[l.portal]||[];
  const india=INDIA_PORTALS.includes(l.portal);
  const rows=[l.title,...(l.glance||[]),...(l.eligibility&&l.eligibility.criteria||[])].map(x=>typeof x==="string"?x:x.k+" "+(x.v||""));
  const text=rows.join(" ");
  // "X desirable" is a scoring bonus, not a requirement
  const needs=re=>rows.some(t=>re.test(t)&&!new RegExp(re.source+"[^.;]*desirable","i").test(t));
  const req=[...base,...(india?["pan-gst","financials"]:[])];
  if(needs(/CERT-In/i))req.push("certin");
  if(needs(/27001/))req.push("iso27001");
  const opt=india&&/exempt(?!ion not)/i.test(text)?["udyam"]:[];
  return {req:[...new Set(req)],opt};
}
/* st: ok | todo | bad (expired, expires before deadline, or can't be done in time) */
function itemState(k,l){
  const s=READY[k],it=RITEM(k),open=l&&isOpen(l),left=open?daysLeft(l.deadline):null;
  if(s.done){
    if(s.expires&&daysLeft(s.expires)<0)return {st:"bad",txt:"Expired "+fmtDate(s.expires)};
    if(s.expires&&open&&s.expires<l.deadline)return {st:"bad",txt:"Expires "+fmtDate(s.expires)+", before the deadline"};
    return {st:"ok",txt:s.expires?"Valid until "+fmtDate(s.expires):"Ready"};
  }
  if(left!=null&&it.leadDays>Math.max(left,0))return {st:"bad",txt:`Not ready. Usually ${it.leadText}; only ${left} day${left===1?"":"s"} left`};
  return {st:"todo",txt:"To do · "+it.leadText};
}
function readySummary(l){
  const {req}=tenderNeeds(l),states=req.map(k=>itemState(k,l));
  return {n:req.length,ok:states.filter(s=>s.st==="ok").length,bad:states.some(s=>s.st==="bad")};
}
function readyChip(l){
  if(!isOpen(l))return "";
  const r=readySummary(l);if(!r.n)return "";
  if(r.ok===r.n)return `<span class="rchip ok">Ready to bid</span>`;
  if(r.bad)return `<span class="rchip bad">Readiness blocked</span>`;
  return `<span class="rchip todo">${r.n-r.ok} to do</span>`;
}
function readyRow(k,l){
  const it=RITEM(k),s=itemState(k,l),done=READY[k].done;
  return `<li class="rrow ${s.st}">
    <button class="rcheck" data-key="${esc(k)}" aria-pressed="${done}" title="${done?"Mark as not done":"Mark as done"}">${done?`<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`:``}</button>
    <div class="rtext"><b>${esc(it.label)}</b><span>${esc(it.why)}</span></div>
    <span class="rstat ${s.st}">${esc(s.txt)}</span>
  </li>`;
}
function readinessCard(l){
  if(!isOpen(l))return "";
  const {req,opt}=tenderNeeds(l);if(!req.length)return "";
  const r=readySummary(l),first=req.find(k=>itemState(k,l).st!=="ok");
  const verdict=r.ok===r.n
    ? `<div class="elig-verdict good"><b>You're ready to bid</b><span>Everything this portal and tender need is in place.</span></div>`
    : r.bad
    ? `<div class="elig-verdict bad"><b>Something can't be ready in time</b><span>Fix what you can now. If a missing certification can't be done before the deadline, bid with a partner who has it.</span></div>`
    : `<div class="elig-verdict warn"><b>${r.n-r.ok} thing${r.n-r.ok===1?"":"s"} to do before you can submit</b><span>Start with: ${esc(RITEM(first).label)}.</span></div>`;
  return `<div class="card ready-card" id="readiness">
    <h2>Bid readiness <span class="count">${r.ok} of ${r.n} ready</span></h2>
    <p class="lead-note">What must be in place before you can submit this tender. Ticks are shared across all your tenders.</p>
    <div class="ready-bar"><i style="width:${Math.round(100*r.ok/r.n)}%"></i></div>
    ${verdict}
    <ul class="ready-list">${req.map(k=>readyRow(k,l)).join("")}</ul>
    ${opt.length?`<div class="reqblock"><div class="rk">Optional: saves you money</div><ul class="ready-list">${opt.map(k=>readyRow(k,l)).join("")}</ul></div>`:``}
    <button class="ready-link" data-goto="ready">Manage all readiness items →</button>
  </div>`;
}
function bindReadyChecks(root,rerender){
  root.querySelectorAll(".rcheck").forEach(b=>b.addEventListener("click",()=>{
    const k=b.dataset.key;READY[k].done=!READY[k].done;saveReady();rerender();
  }));
  root.querySelectorAll("[data-goto=ready]").forEach(b=>b.addEventListener("click",showReady));
}
function renderReady(){
  const v=$("#readyView");
  const open=LEADS.filter(isOpen);
  const usedBy=k=>open.filter(l=>tenderNeeds(l).req.includes(k)).length;
  const groups=[...new Set(READINESS_ITEMS.map(i=>i.group))];
  const total=READINESS_ITEMS.length,ok=READINESS_ITEMS.filter(i=>itemState(i.key).st==="ok").length;
  v.innerHTML=`
    <div class="page-head"><div><h1>Bid readiness</h1><p>${ok} of ${total} in place · your signature, portal accounts and documents. Every tender checks against this list.</p></div></div>
    ${groups.map(g=>`<div class="card ready-group">
      <h2>${esc(g)}</h2>
      <ul class="ready-list">${READINESS_ITEMS.filter(i=>i.group===g).map(it=>{const s=itemState(it.key),n=usedBy(it.key);return `<li class="rrow ${s.st}">
        <button class="rcheck" data-key="${esc(it.key)}" aria-pressed="${READY[it.key].done}" title="${READY[it.key].done?"Mark as not done":"Mark as done"}">${READY[it.key].done?`<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`:``}</button>
        <div class="rtext"><b>${esc(it.label)}</b><span>${esc(it.why)}${n?` Needed by ${n} open tender${n===1?"":"s"}.`:``}</span>
          ${it.expiry?`<label class="rexp">Valid until <input type="date" data-exp="${esc(it.key)}" value="${esc(READY[it.key].expires||"")}"></label>`:``}</div>
        <span class="rstat ${s.st}">${esc(s.txt)}</span>
      </li>`;}).join("")}</ul>
    </div>`).join("")}
    <p class="disclaimer">Demo: your ticks and dates are saved in this browser only. <button class="linkbtn" id="resetReady">Reset to demo data</button></p>
  `;
  bindReadyChecks(v,renderReady);
  v.querySelectorAll("[data-exp]").forEach(inp=>inp.addEventListener("change",()=>{READY[inp.dataset.exp].expires=inp.value||undefined;saveReady();renderReady();}));
  $("#resetReady").addEventListener("click",()=>{try{localStorage.removeItem(RKEY);}catch(e){}READY=loadReady();renderReady();});
}

/* ---------- change watcher ----------
   Each lead's `changes` (newest first after sorting): deadline moves,
   corrigenda, new clarifications. In the product a daily job re-reads every
   open tender and records diffs here. */
const RECENT_DAYS=14;
const daysAgo=d=>-daysLeft(d);
const sortedChanges=l=>(l.changes||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
const recentChanges=l=>sortedChanges(l).filter(c=>daysAgo(c.date)<=RECENT_DAYS);
const CHG_LABEL={deadline:"Date change",corrigendum:"Corrigendum",document:"Document change",clarification:"Clarification"};
function changeFlag(l){const c=recentChanges(l)[0];return c?`<span class="chg-flag">Changed ${esc(fmtDate(c.date).replace(/ \d{4}$/,""))}</span>`:"";}
function changeItem(c,l){
  return `<li class="chg ${esc(c.kind)}">
    <div class="chg-top"><span class="chg-kind">${esc(CHG_LABEL[c.kind]||"Change")}</span><span class="chg-date">${fmtDate(c.date)}${daysAgo(c.date)<=RECENT_DAYS?` · <b>new</b>`:``}</span></div>
    ${l?`<button class="chg-lead" data-open="${esc(l.id)}">${esc(l.buyer)}: ${esc(l.title)}</button>`:``}
    <div class="chg-title">${esc(c.title)}</div>
    ${c.from||c.to?`<div class="chg-diff">${c.from?`<s>${esc(c.from)}</s> → `:``}<span>${esc(c.to||"")}</span></div>`:``}
    ${c.link?`<a class="chg-src" href="${esc(c.link)}" target="_blank" rel="noopener">Open the notice ↗</a>`:``}
  </li>`;
}
function changesCard(l){
  const cs=sortedChanges(l);if(!cs.length)return "";
  return `<div class="card chg-card">
    <h2>What changed <span class="count">${cs.length}</span></h2>
    <p class="lead-note">Changes to this tender's dates, documents and answers, newest first.</p>
    <ul class="chg-list">${cs.map(c=>changeItem(c)).join("")}</ul>
  </div>`;
}

/* ---------- calendar (.ics) ---------- */
function icsDate(l){
  const m=(l.deadlineTime||"").match(/(\d{1,2}):(\d{2})/);
  if(!m)return {allDay:true,v:l.deadline.replace(/-/g,"")};
  // IST deadlines are converted to UTC; others are treated as the viewer's local time
  const ist=/IST|\+05:30/.test(l.deadlineTime);
  const d=ist?new Date(`${l.deadline}T${m[1].padStart(2,"0")}:${m[2]}:00+05:30`):new Date(`${l.deadline}T${m[1].padStart(2,"0")}:${m[2]}:00`);
  return {allDay:false,v:d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")};
}
function downloadIcs(l){
  const d=icsDate(l),stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const icsEsc=s=>String(s).replace(/[\\;,]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const alarm=t=>["BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEsc("Tender deadline: "+l.title)}`,`TRIGGER:-${t}`,"END:VALARM"];
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TenderLens//EN","BEGIN:VEVENT",
    `UID:${l.id}-${l.deadline}@tenderlens`,`DTSTAMP:${stamp}`,
    d.allDay?`DTSTART;VALUE=DATE:${d.v}`:`DTSTART:${d.v}`,
    `SUMMARY:${icsEsc("Bid deadline · "+l.buyer)}`,
    `DESCRIPTION:${icsEsc(l.title+"\nRef: "+nz(l.ref)+"\nSubmit via: "+nz(l.submitVia)+"\nNotice: "+(l.noticeUrl||""))}`,
    `URL:${l.portalUrl||l.noticeUrl||""}`,
    ...alarm("P7D"),...alarm("P3D"),...alarm("P1D"),"END:VEVENT","END:VCALENDAR"];
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([lines.join("\r\n")],{type:"text/calendar"}));
  a.download=`${l.id}-deadline.ics`;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ---------- alerts ---------- */
const AKEY="tl-alerts";
function loadAlertPrefs(){let p={};try{p=JSON.parse(localStorage.getItem(AKEY)||"{}")||{};}catch(e){}return Object.assign({whatsapp:true,email:true,time:"09:00",minFit:70},p);}
let ALERTS=loadAlertPrefs();
function saveAlertPrefs(){try{localStorage.setItem(AKEY,JSON.stringify(ALERTS));}catch(e){}}
function alertData(){
  const open=LEADS.filter(isOpen);
  const closing=open.filter(l=>daysLeft(l.deadline)<=7).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  const changes=LEADS.flatMap(l=>recentChanges(l).map(c=>({c,l}))).sort((a,b)=>b.c.date.localeCompare(a.c.date));
  const todo=open.filter(l=>{const r=readySummary(l);return r.n&&r.ok<r.n;});
  const matches=open.filter(l=>l.fit>=ALERTS.minFit).sort((a,b)=>b.fit-a.fit);
  return {closing,changes,todo,matches};
}
const alertCount=()=>{const a=alertData();return a.changes.length+a.closing.length;};
function digestText(){
  const a=alertData(),dl=l=>{const n=daysLeft(l.deadline);return n===0?"closes today":n===1?"closes tomorrow":`closes in ${n} days`;};
  const short=l=>`${l.buyer.replace(/ \(.*\)$/,"")}: ${l.title.length>60?l.title.slice(0,57)+"…":l.title}`;
  const out=[`*TenderLens daily digest* · ${new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}`,""];
  if(a.closing.length){out.push("⏰ *Closing this week*");a.closing.forEach(l=>out.push(`• ${short(l)} · ${dl(l)}`));out.push("");}
  if(a.changes.length){out.push("🔄 *Changes*");a.changes.forEach(({c,l})=>out.push(`• ${l.buyer.replace(/ \(.*\)$/,"")}: ${c.title}${c.from?` (${c.from} → ${c.to})`:""}`));out.push("");}
  if(a.todo.length){out.push("✅ *Get ready*");a.todo.forEach(l=>{const first=tenderNeeds(l).req.find(k=>itemState(k,l).st!=="ok");out.push(`• ${l.buyer.replace(/ \(.*\)$/,"")}: ${RITEM(first).label}`);});out.push("");}
  out.push(`🎯 ${a.matches.length} open tenders match your profile (fit ${ALERTS.minFit}+).`,"Open TenderLens for details.");
  return out.join("\n");
}
function renderAlerts(){
  const v=$("#alertsView"),a=alertData();
  const leadLine=l=>`<button class="alert-row" data-open="${esc(l.id)}"><span class="deadline-pill ${deadlineInfo(l).cls}">${esc(deadlineInfo(l).txt)}</span><span><b>${esc(l.buyer)}</b> · ${esc(l.title)}</span></button>`;
  v.innerHTML=`
    <div class="page-head"><div><h1>Alerts</h1><p>Changes to your tenders, deadlines this week, and what to get ready, in one place and in your daily digest.</p></div></div>
    <div class="cols">
      <div class="col">
        <div class="card"><h2>Changes in the last ${RECENT_DAYS} days <span class="count">${a.changes.length}</span></h2>
          ${a.changes.length?`<ul class="chg-list">${a.changes.map(({c,l})=>changeItem(c,l)).join("")}</ul>`:`<p class="lead-note">No changes to your tenders recently.</p>`}</div>
        <div class="card"><h2>Closing in the next 7 days <span class="count">${a.closing.length}</span></h2>
          <div class="alert-list">${a.closing.map(leadLine).join("")||`<p class="lead-note">Nothing closes this week.</p>`}</div></div>
      </div>
      <div class="col">
        <div class="card"><h2>Daily digest</h2>
          <p class="lead-note">What your team would receive each morning.</p>
          <div class="alert-prefs">
            <label><input type="checkbox" id="prefWa" ${ALERTS.whatsapp?"checked":""}> WhatsApp</label>
            <label><input type="checkbox" id="prefEmail" ${ALERTS.email?"checked":""}> Email</label>
            <label>at <input type="time" id="prefTime" value="${esc(ALERTS.time)}"></label>
            <label>matches with fit <select id="prefFit">${[60,70,80].map(n=>`<option value="${n}" ${ALERTS.minFit===n?"selected":""}>${n}+</option>`).join("")}</select></label>
          </div>
          <div class="digest"><div class="digest-meta">${ALERTS.whatsapp?"WhatsApp":ALERTS.email?"Email":"Paused"} · ${esc(ALERTS.time)} preview</div><pre>${esc(digestText())}</pre></div>
          <p class="disclaimer" style="text-align:left;margin:10px 0 0">Preview only. Sending needs the TenderLens backend and a WhatsApp Business account.</p>
        </div>
      </div>
    </div>`;
  v.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.open)));
  const upd=()=>{ALERTS={whatsapp:$("#prefWa").checked,email:$("#prefEmail").checked,time:$("#prefTime").value||"09:00",minFit:+$("#prefFit").value};saveAlertPrefs();renderAlerts();};
  ["#prefWa","#prefEmail","#prefTime","#prefFit"].forEach(s=>$(s).addEventListener("change",upd));
}

/* ---------- detail view ---------- */
function openDetail(id,keepScroll){
  const l=LEADS.find(x=>x.id===id);if(!l)return;
  const y=scrollY;
  const C=2*Math.PI*52,off=C*(1-l.fit/100),di=deadlineInfo(l);
  const dv=$("#detailView");
  dv.innerHTML=`
    <button class="back" id="backBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> My leads</button>
    <div class="detail-top">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="id-badge">${esc(l.id)}</span>
        ${proofBadge(l)}
        <span class="type-badge">${esc(l.type)}</span>
        <span class="src-badge">${esc(l.source)} · Ref ${esc(nz(l.ref))}</span>
      </div>
      <a class="ledger-link">Evidence ledger <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    </div>

    ${l.verified?`<p class="verified-note">Real tender. Details below were read from the official notice on ${fmtDate(l.verified)}; anything marked "Not stated" hasn't been checked yet. The fit score is against the demo profile.</p>`:``}
    <div class="hero">
      <div class="hero-grid">
        <div>
          <h1>${esc(l.title)}</h1>
          <div class="buyer"><strong style="font-weight:600;color:var(--fg)">${esc(l.buyer)}</strong><span class="dot"></span><span>${esc(l.sector)}</span><span class="dot"></span><span>📍 ${esc(l.location)}</span></div>
          <div class="tags">
            ${l.language?`<span class="tag">🗣 Proposal in ${esc(l.language)}</span>`:``}
            ${l.procedure?`<span class="tag">${esc(l.procedure)}</span>`:``}
            ${l.category?`<span class="tag">${esc(l.category)}</span>`:``}
            <span class="tag">${esc(l.vertical)}</span>
          </div>
          <div class="actions">
            ${PORTAL_GUIDES[l.portal]?`<button class="btn primary" id="applyBtn">How to apply <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:``}
            ${isOpen(l)?`<button class="btn" id="icsBtn">Add deadline to calendar</button>`:``}
            <a class="btn" href="${esc(l.noticeUrl)}" target="_blank" rel="noopener">Open official notice <svg viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
          </div>
        </div>
        <div class="fit-ring">
          <div class="ring-wrap">
            <svg width="118" height="118" viewBox="0 0 118 118">
              <circle cx="59" cy="59" r="52" fill="none" stroke="var(--surface-3)" stroke-width="11"/>
              <circle cx="59" cy="59" r="52" fill="none" stroke="${fitColor(l.fit)}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
            </svg>
            <div class="ring-center"><span class="num">${l.fit}</span><span class="den">/ 100 fit</span></div>
          </div>
          <div style="text-align:center">
            <div class="label" style="color:${fitColor(l.fit)}">${l.fit>=80?"Strong match":l.fit>=70?"Good match":l.fit>=60?"Worth a look":"Stretch"}</div>
            <div class="note">How well this matches your profile — not a win probability.</div>
          </div>
        </div>
      </div>

      <div class="facts">
        <div class="fact"><div class="k">Deadline</div><div class="v ${di.cls==="soon"?"soon":""}">${l.deadline?fmtDate(l.deadline):"Not stated"}<small>${l.deadlineTime?esc(l.deadlineTime)+" · ":""}${esc(di.txt.toLowerCase())}</small></div></div>
        <div class="fact"><div class="k">Proposal language</div><div class="v">${esc(nz(l.language))}</div></div>
        <div class="fact"><div class="k">Submit via</div><div class="v" style="font-size:14px">${esc(nz(l.submitVia))}</div></div>
        <div class="fact"><div class="k">Budget / value</div><div class="v">${esc(nz(l.value))}</div></div>
      </div>
    </div>

    <div class="acc-tools"><button class="acc-all" data-open="1">Expand all</button><button class="acc-all" data-open="0">Collapse all</button></div>
    <div class="cols">
      <div class="col">
        ${eligibilityCard(l)}
        ${needCard(l)}
        ${readinessCard(l)}
        ${applyCard(l)}
        ${qnaCard(l)}
        ${formatCard(l)}
      </div>
      <div class="col">
        ${changesCard(l)}
        ${costCard(l)}
        ${glanceCard(l)}
        ${contactsCard(l)}
      </div>
    </div>
    <p class="disclaimer">Evidence shown is extracted from the published notice and tender documents. Verify all figures and dates against the official source before bidding.</p>
  `;
  $("#backBtn").addEventListener("click",showList);
  const ib=$("#icsBtn");if(ib)ib.addEventListener("click",()=>downloadIcs(l));
  makeAccordions(dv);
  const ab=$("#applyBtn");if(ab)ab.addEventListener("click",()=>openSection("howToApply"));
  dv.querySelectorAll(".copybtn").forEach(b=>b.addEventListener("click",()=>copyText(b)));
  bindReadyChecks(dv,()=>openDetail(id,true));
  window.scrollTo(0,keepScroll?y:0);
  $("#listView").hidden=true;$("#readyView").hidden=true;$("#alertsView").hidden=true;dv.hidden=false;
}
/* ---------- detail sections as accordions ----------
   Each detail card becomes <details>: its h2 is the always-visible summary (so
   counts like "4 of 5 ready" stay scannable), the rest folds away. Open/closed
   state is remembered per section title in this browser. */
const SKEY="tl-sections";
const ACC_DEFAULT_OPEN=["Eligibility & who can bid","What they need","What changed","Cost to bid"];
let ACC={};try{ACC=JSON.parse(localStorage.getItem(SKEY)||"{}")||{};}catch(e){}
function saveAcc(){try{localStorage.setItem(SKEY,JSON.stringify(ACC));}catch(e){}}
function makeAccordions(root){
  root.querySelectorAll(".cols .col > .card").forEach(card=>{
    const h=card.querySelector(":scope > h2");if(!h)return;
    const key=(h.firstChild&&h.firstChild.textContent||h.textContent).trim();
    const d=document.createElement("details");
    d.className=card.className+" acc";if(card.id)d.id=card.id;d.dataset.key=key;
    d.open=key in ACC?ACC[key]:ACC_DEFAULT_OPEN.includes(key);
    const sum=document.createElement("summary");sum.appendChild(h);
    sum.insertAdjacentHTML("beforeend",`<svg class="acc-chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    const body=document.createElement("div");body.className="acc-body";
    while(card.firstChild)body.appendChild(card.firstChild);
    d.append(sum,body);
    d.addEventListener("toggle",()=>{ACC[key]=d.open;saveAcc();});
    card.replaceWith(d);
  });
  root.querySelectorAll(".acc-all").forEach(b=>b.addEventListener("click",()=>{
    root.querySelectorAll("details.acc").forEach(d=>{d.open=b.dataset.open==="1";});
  }));
}
function openSection(id){const d=document.getElementById(id);if(!d)return;d.open=true;d.scrollIntoView({behavior:"smooth",block:"start"});}
function needCard(l){const n=l.need,sv=n.services||[],dv=n.deliverables||[];
  return `<div class="card">
    <h2>What they need</h2>
    <p class="lead-note">${esc(n.summary)}</p>
    ${n.what?`<div class="reqblock"><div class="rk">What exactly</div><p>${esc(n.what)}</p>
      ${n.whatQuote?`<p style="font-family:var(--fs-mono);font-size:12px;color:var(--muted);margin-top:8px">${esc(n.whatQuote)}</p>`:``}</div>`:``}
    ${sv.length?`<div class="reqblock"><div class="rk">Services required</div><div class="pills">${sv.map(s=>`<span class="p">${esc(s)}</span>`).join("")}</div></div>`:``}
    ${dv.length?`<div class="reqblock"><div class="rk">Deliverables</div>
      <ul class="deliver">${dv.map(d=>`<li><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(d)}</span></li>`).join("")}</ul></div>`:``}
    ${l.keywords&&l.keywords.length?`<div class="reqblock"><div class="rk">Found by your keywords</div><div class="pills">${l.keywords.map(k=>`<span class="p kw">${esc(k)}</span>`).join("")}</div></div>`:``}
  </div>`;
}
function costCard(l){
  const f=l.fees||{},c=costOf(l);
  const row=(k,it,when,note)=>{
    const waived=it&&useExemption&&exemptForYou(it);
    const ex=it&&it.exempt==="allowed"?(waived?"Exemption allowed; your Udyam certificate should waive it":"Exemption allowed for MSEs and startups")
      :it&&it.exempt==="none"?"No exemption, MSEs and startups pay it too":"";
    return `<div class="grow">
      <div class="gk">${it?`<span class="pdot ${it.src===OFFICIAL?"official":"ai"}"></span>`:`<span class="pdot none"></span>`}<span><b class="ck">${esc(k)}</b><small class="cwhen">${esc(when)}</small></span></div>
      ${it?`<div class="gv">${esc(it.text)}${ex?`<small class="cex ${waived?"good":""}">${esc(ex)}</small>`:""}${note?`<small class="cex">${esc(note)}</small>`:""}</div>`
          :`<div class="gv na">Not stated in the notice</div>`}
    </div>`;
  };
  const v={
    free:{c:"good",b:"Free to bid",s:"No document fee and no bid security stated."},
    deposit:{c:"warn",b:`${fmtMoney(c.deposit,c.cur)} locked up until the result`,s:`No fee to take part. The ${isIndia(l)?"EMD":"bid security"} comes back if you lose, or once the contract is signed if you win.`},
    fee:{c:"warn",b:`${c.fee?fmtMoney(c.fee,c.cur):"A fee"} you won't get back${c.deposit?`, plus ${fmtMoney(c.deposit,c.cur)} refundable deposit`:""}`,s:"Budget the fee as a sunk cost of bidding, win or lose."},
    unstated:{c:"muted",b:"Not fully stated",s:"Check the tender document for the fee and bid security before you commit."},
  }[c.cls];
  return `<div class="card" id="costToBid">
    <h2>Cost to bid</h2>
    <p class="lead-note">What you pay to take part, before you know the result. Performance security only applies if you win.</p>
    <div class="elig-verdict ${v.c}"><b>${esc(v.b)}</b><span>${esc(v.s)}</span></div>
    <div class="glance" style="margin-top:6px">
      ${row("Tender / document fee",f.doc,"Before you bid · non-refundable")}
      ${f.portal?row("Portal charges",f.portal,"When you submit · non-refundable"):""}
      ${row(bidLabel(l),f.bid,"With your bid · refundable")}
      ${row("Performance security",f.perf,"If you win · held until the contract ends")}
    </div>
  </div>`;
}
/* Fill {id} {emd} {deadline} {portal} in guide text from the lead (see guides.js). */
function applyFill(s,l){
  const row=k=>(l.glance||[]).find(x=>x.k===k)||(l.eligibility&&l.eligibility.criteria||[]).find(x=>x.k===k);
  const val=k=>{const r=row(k);return r&&r.v;};
  const id=val("Tender ID")||val("GeM bid number")||val("Bid number")||l.ref||"shown on the notice";
  const emd=val("EMD")||"as stated in the tender document";
  const deadline=l.deadline?fmtDate(l.deadline)+(l.deadlineTime?", "+l.deadlineTime:""):"the deadline in the tender document";
  let portal="the buyer's portal";try{if(l.portalUrl)portal=new URL(l.portalUrl).host;}catch(e){}
  return s.replace(/\{(id|emd|deadline|portal)\}/g,(_,k)=>({id,emd,deadline,portal})[k]);
}
function applyCard(l){const G=PORTAL_GUIDES[l.portal];if(!G)return "";
  return `<div class="card apply-card" id="howToApply">
    <h2>How to apply <span class="count">${G.steps.length} steps</span></h2>
    <p class="lead-note">${esc(G.intro)}</p>
    ${isOpen(l)?``:`<p class="apply-closed">This tender has closed. The steps are kept as a guide for the next tender on this portal.</p>`}
    <div class="reqblock"><div class="rk">Have these ready</div>
      <ul class="apply-prep">${G.prep.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>
    <div class="reqblock"><div class="rk">Steps on ${esc(G.name)}</div>
      <ol class="apply-steps">${G.steps.map((s,i)=>`<li><span class="n">${i+1}</span><div><b>${esc(applyFill(s.t,l))}</b><p>${esc(applyFill(s.d,l))}</p></div></li>`).join("")}</ol></div>
    <div class="apply-foot">
      ${l.portalUrl?`<a class="btn" href="${esc(l.portalUrl)}" target="_blank" rel="noopener">Go to the portal <svg viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`:``}
      <span>${G.help?esc(G.help)+" ":""}These are general steps for this portal; the tender document always takes priority.</span>
    </div>
  </div>`;
}
function eligibilityCard(l){const e=l.eligibility;if(!e)return "";
  const V=e.verdict&&ELIG[e.verdict.status];
  return `<div class="card">
    <h2>Eligibility &amp; who can bid</h2>
    <p class="lead-note">${V?"Pre-qualification criteria from the tender, checked against your profile.":"Criteria read from the official notice so far. The full eligibility clauses are in the tender documents."}</p>
    ${V?`<div class="elig-verdict ${V.c}"><b>${V.t}</b><span>${esc(e.verdict.note)}</span></div>`:``}
    <div class="legend">
      <span><span class="pdot official"></span> Stated in official notice</span>
      <span><span class="pdot ai"></span> Read from document by AI</span>
    </div>
    <div class="glance">
      ${e.criteria.map(c=>`<div class="grow">
        <div class="gk"><span class="pdot ${c.src===OFFICIAL?"official":"ai"}" title="${c.src===OFFICIAL?"Stated in official notice":"AI-extracted (quote verified)"}"></span>${esc(c.k)}</div>
        <div class="gv">${c.v==null?`<span class="na">Not stated in the notice</span>`:esc(c.v)}${c.quote?`<div class="gv quote" style="margin-top:4px">${esc(c.quote)}</div>`:""}${c.verified===false?`<div class="qwarn">Quote not found in the PDF text. Check page ${esc(c.page)} before relying on it.</div>`:""}${c.you?`<div><span class="ystat ${c.you}" ${c.youWhy?`title="${esc(c.youWhy)}"`:""}>${YOU[c.you]}</span>${c.youWhy?`<span class="ywhy">${esc(c.youWhy)}</span>`:""}</div>`:""}</div>
      </div>`).join("")}
    </div>
  </div>`;
}
function qnaCard(l){
  if(!l.qna)return "";
  const w=l.qna.window,open=w.status==="open",ddl=daysLeft(w.questionsDeadline);
  const rel=l.qna.items.filter(i=>i.relevant).length;
  const status=open
    ? `<span class="qna-status open">Questions window open${ddl>0?" · "+ddl+" days left":" · closes today"}</span>`
    : `<span class="qna-status closed">Window closed · answers published</span>`;
  return `<div class="card qna-card">
    <h2>Clarifications &amp; vendor Q&amp;A <span class="count">${l.qna.items.length}</span></h2>
    <div class="qna-head">${status}<span class="qna-ddl">${open?"Submit questions by":"Questions closed"} ${fmtDate(w.questionsDeadline)}</span></div>
    <div class="synth">
      <div class="synth-h"><svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.6 1 1 1 2v.5h6V15.5c0-1 .3-1.4 1-2A6 6 0 0012 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Before you write your proposal</div>
      <ul>${l.qna.synthesis.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>
    </div>
    ${open?`<p class="qna-cta">The question window is still open — ${rel} of ${l.qna.items.length} published clarifications are relevant to your profile, and you can still submit your own.</p>`:``}
    <div class="qna-list">${l.qna.items.map(qnaItem).join("")}</div>
  </div>`;
}
function qnaItem(it){
  const lbl={high:"High impact",med:"Medium impact",low:"Low impact"}[it.impact]||"";
  return `<div class="qna-item ${it.relevant?"relevant":""}">
    <div class="qna-tags">
      <span class="qcat">${esc(it.category)}</span>
      <span class="qimpact ${it.impact}">${lbl}</span>
      ${it.relevant?`<span class="qrel">● Relevant to you</span>`:``}
    </div>
    <div class="qna-q"><span class="ql">Q</span><p>${esc(it.q)}</p></div>
    <div class="qna-a ${it.answered===false?"pending":""}"><span class="ql">A</span><p>${esc(it.a)}</p></div>
    <div class="qna-why"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg><span><b>Why it matters:</b> ${esc(it.why)}</span></div>
  </div>`;
}
function formatCard(l){const f=l.format;if(!f)return "";
  return `<div class="card">
    <h2>Questions &amp; proposal format</h2>
    <p class="lead-note">What your proposal must answer and how it must be delivered.</p>
    <div class="glance" style="margin-top:8px">
      <div class="grow"><div class="gk">Page / word limit</div><div class="gv ${f.pageLimit?"":"na"}">${f.pageLimit?esc(f.pageLimit):"Not stated in the notice"}</div></div>
      <div class="grow"><div class="gk">File format</div><div class="gv ${f.fileFormat?"":"na"}">${f.fileFormat?esc(f.fileFormat):"Not stated in the notice"}</div></div>
      <div class="grow"><div class="gk">How to submit</div><div class="gv">${esc(f.method)}</div></div>
    </div>
  </div>`;
}
function glanceCard(l){
  return `<div class="card">
    <h2>At a glance</h2>
    <div class="legend">
      <span><span class="pdot official"></span> Stated in official notice</span>
      <span><span class="pdot ai"></span> Read from document by AI</span>
    </div>
    <div class="glance">
      ${l.glance.map(g=>`<div class="grow">
        <div class="gk"><span class="pdot ${g.src===OFFICIAL?"official":"ai"}" title="${g.src===OFFICIAL?"Stated in official notice":"AI-extracted (quote verified)"}"></span>${esc(g.k)}</div>
        ${g.v==null
          ? `<div class="gv na">Not stated in the notice</div>`
          : `<div class="gv">${g.link?`<a href="${esc(g.v)}" target="_blank" rel="noopener">${esc(g.v)}</a>`:esc(g.v)}${g.quote?`<div class="gv quote" style="margin-top:4px">${esc(g.quote)}</div>`:""}</div>`}
      </div>`).join("")}
    </div>
  </div>`;
}
function contactsCard(l){
  if(!l.contacts||!l.contacts.length)return "";
  return `<div class="card">
    <h2>Contacts <span class="count">${l.contacts.length}</span></h2>
    ${l.contacts.map(c=>`<div class="contact">
      <div><div class="cname">${esc(c.name)}</div><div class="crole">${esc(c.role)}</div></div>
      <div class="crow"><a href="mailto:${esc(c.email)}">✉ ${esc(c.email)}</a><button class="copybtn" data-copy="${esc(c.email)}">Copy</button></div>
    </div>`).join("")}
  </div>`;
}
async function copyText(btn){
  const t=btn.dataset.copy;
  try{await navigator.clipboard.writeText(t);}catch(e){
    const r=document.createRange();const span=document.createElement("span");span.textContent=t;span.style.position="fixed";span.style.opacity="0";document.body.appendChild(span);r.selectNode(span);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);try{document.execCommand("copy");}catch(_){}sel.removeAllRanges();span.remove();
  }
  const old=btn.textContent;btn.textContent="Copied";btn.classList.add("done");setTimeout(()=>{btn.textContent=old;btn.classList.remove("done");},1400);
}

/* ---------- view switching ---------- */
const VIEWS=["listView","detailView","readyView","alertsView"];
function showView(id){VIEWS.forEach(v=>{$("#"+v).hidden=v!==id;});window.scrollTo(0,0);updateAlertBadge();}
function setNav(view){document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",view==="list"?x.id==="navLeads":x.dataset.view===view));}
function updateAlertBadge(){const n=alertCount(),b=$("#navAlerts .nbadge");if(b){b.textContent=n;b.hidden=!n;}}
function showList(){setNav("list");renderList();showView("listView");}
function showReady(){setNav("ready");renderReady();showView("readyView");}
function showAlerts(){setNav("alerts");renderAlerts();showView("alertsView");}
$("#homeBtn").addEventListener("click",showList);
document.querySelectorAll(".nav button").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.view==="ready"){showReady();return;}
  if(b.dataset.view==="alerts"){showAlerts();return;}
  showList();document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x===b));
}));

/* ---------- theme toggle ---------- */
const sun='<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const moon='<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8 8 0 019.5 4a7 7 0 108.9 10.5c.3-.1.6.2.5.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function sysDark(){return matchMedia("(prefers-color-scheme:dark)").matches;}
function curDark(){const t=document.documentElement.getAttribute("data-theme");return t?t==="dark":sysDark();}
function setThemeIcon(){$("#themeBtn").innerHTML=curDark()?sun:moon;}
(function initTheme(){try{const s=localStorage.getItem("tl-theme");if(s)document.documentElement.setAttribute("data-theme",s);}catch(e){}setThemeIcon();})();
$("#themeBtn").addEventListener("click",()=>{const next=curDark()?"light":"dark";document.documentElement.setAttribute("data-theme",next);try{localStorage.setItem("tl-theme",next);}catch(e){}setThemeIcon();});
matchMedia("(prefers-color-scheme:dark)").addEventListener("change",setThemeIcon);

/* ---------- boot ---------- */
renderList();updateAlertBadge();
