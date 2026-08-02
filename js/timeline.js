/* timeline.js — 时间轴视图：章节带 + 事件行渲染、筛选/搜索联动、详情抽屉、章节回顶 */
'use strict';

const TYPES=["全部","政治","军事","经济","文化","制度"];
const IMPS=[["全部",0],["★★★",3],["★★",2],["★",1]];
const state={type:"全部",imp:0,q:""};

/* ---- 渲染：全 15 章章节带 + 事件行（空章占位） ---- */
const main=document.getElementById("main");
CHAPTERS.forEach((c,ci)=>{
  const band=document.createElement("div");
  band.className="band"; band.id=c.id;
  band.innerHTML='<span class="sq"></span><span class="no">'+c.no+'</span><h2>'+c.name+'</h2><span class="note">'+c.note+'</span><span class="rule"></span>';
  main.appendChild(band);
  const rows=EVENTS.filter(e=>e.ch===ci);
  if(rows.length===0){
    const empty=document.createElement("div");
    empty.className="row";
    empty.innerHTML='<div class="year"></div><div class="body"><div class="summary" style="color:var(--ink3)">（数据待生成）</div></div>';
    main.appendChild(empty);
    return;
  }
  EVENTS.forEach((e,idx)=>{
    if(e.ch!==ci) return;
    const row=document.createElement("div");
    row.className="row "+e.yearMode; row.dataset.idx=idx; row.dataset.type=e.type; row.dataset.imp=e.importance;
    const yr=document.createElement("div"); yr.className="year";
    if(e.yearMode==="era"){
      yr.innerHTML=e.era
        ? '<span class="era">'+e.era+(e.eraSub?'<br>'+e.eraSub:'')+'</span>'
        : '<span class="era">'+(e.dynasty||e.period||'时代')+'</span>';  /* Q4 回填前暂显朝代 */
    }else{
      yr.textContent=fmtShort(e);
    }
    const body=document.createElement("div"); body.className="body";
    body.innerHTML='<div class="title-row"><span class="stars">'+stars(e.importance)+'</span><h3>'+e.title+'</h3><span class="tag">'+e.type+'</span></div><div class="summary">'+e.summary+'</div>';
    body.addEventListener("click",()=>openDrawer(idx));
    yr.addEventListener("click",()=>openDrawer(idx));
    row.appendChild(yr); row.appendChild(body);
    main.appendChild(row);
  });
});

/* ---- 分期筛选链接（按 CHAPTERS 动态生成） ---- */
(function(){
  const perGroup=document.getElementById("perGroup");
  if(!perGroup) return;
  CHAPTERS.forEach(c=>{
    const a=document.createElement("a");
    a.className="jump"; a.href="#"+c.id; a.textContent=c.name;
    perGroup.appendChild(a);
  });
})();

/* ---- 顶框筛选按钮（门类/等第） ---- */
function mkBtns(groupId,items,key,render){
  const g=document.getElementById(groupId);
  items.forEach(it=>{
    const label=render?it[0]:it, val=render?it[1]:it;
    const b=document.createElement("button");
    b.className="f"+(state[key]===val?" on":""); b.textContent=label;
    b.addEventListener("click",()=>{state[key]=val;
      g.querySelectorAll("button.f").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); renderChips(); applyFilter();});
    g.appendChild(b);
  });
}
mkBtns("typeGroup",TYPES,"type",false);
mkBtns("impGroup",IMPS,"imp",true);

/* ---- 已选条件 chip ---- */
function renderChips(){
  const c=document.getElementById("chips"); c.innerHTML="";
  const items=[];
  if(state.type!=="全部") items.push({k:"type",v:state.type});
  if(state.imp!==0) items.push({k:"imp",v:state.imp===3?"★★★":(state.imp===2?"★★":"★")});
  if(state.q) items.push({k:"q",v:'"'+state.q+'"'});
  items.forEach(it=>{
    const s=document.createElement("span");
    s.className="chip";
    s.innerHTML=it.v+'<button class="x" data-k="'+it.k+'">×</button>';
    s.querySelector(".x").addEventListener("click",()=>{
      if(it.k==="type"){state.type="全部";setBtn("typeGroup",0);}
      else if(it.k==="imp"){state.imp=0;setBtn("impGroup",0);}
      else if(it.k==="q"){state.q="";qInput.value="";}
      renderChips();applyFilter();
    });
    c.appendChild(s);
  });
}
function setBtn(gid,idx){
  const g=document.getElementById(gid);
  g.querySelectorAll("button.f").forEach((b,i)=>b.classList.toggle("on",i===idx));
}

/* ---- 筛选面板展开/收起 + 关键词搜索 ---- */
const filterToggle=document.getElementById("filterToggle"), filters=document.getElementById("filters");
filterToggle.addEventListener("click",()=>{
  filters.hidden=!filters.hidden;
  filterToggle.textContent=filters.hidden?"筛选":"收起";
});
const qInput=document.getElementById("q");
qInput.addEventListener("input",()=>{state.q=qInput.value.trim();renderChips();applyFilter();});

/* ---- 筛选应用（时间轴行 + 地图 marker 联动） ---- */
function applyFilter(){
  let n=0;
  const q=(state.q||"").toLowerCase();
  document.querySelectorAll(".row").forEach(r=>{
    if(!r.dataset.idx) return; /* 空章占位行不参与筛选 */
    const e=EVENTS[Number(r.dataset.idx)];
    const ok=(state.type==="全部"||r.dataset.type===state.type)&&
             (state.imp===0||Number(r.dataset.imp)===state.imp)&&
             (!q||matchEvent(e,q));
    r.style.display=ok?"":"none"; if(ok)n++;
  });
  const filtered=(state.type!=="全部"||state.imp!==0||state.q);
  document.getElementById("cnt").textContent=filtered?("筛得 "+n+" 事"):("共 "+EVENTS.length+" 事");
  document.getElementById("empty").hidden=n>0;
  if(typeof drawMarkers==="function") drawMarkers(); /* 地图视图联动：筛选同时作用于 marker */
}
document.getElementById("cnt").textContent="共 "+EVENTS.length+" 事";

/* ---- 详情抽屉 ---- */
const drawer=document.getElementById("drawer");
const overlay=document.getElementById("overlay");
function openDrawer(idx){
  const e=EVENTS[idx];
  document.getElementById("dYear").textContent=e.yearMode==="era"
    ? (e.era? (e.era+(e.eraSub?" · "+e.eraSub:"")) : (e.dynasty||e.period||"时代"))
    : fmt(e);
  document.getElementById("dTitle").textContent=e.title;
  document.getElementById("dMeta").innerHTML=
    '<span class="tag">'+e.dynasty+'</span><span class="tag">'+e.period+'</span><span class="tag">'+e.type+'</span><span class="stars">'+stars(e.importance)+'</span>';
  document.getElementById("dSum").textContent=e.summary;
  toggle("secCau",e.cause,"dCau"); toggle("secEff",e.effect,"dEff");
  document.getElementById("dTip").textContent=e.examTip;
  toggle("secPpl",e.people.length?e.people.join("、"):null,"dPpl");
  toggle("secLoc",e.location||null,"dLoc");
  toggle("secTag",e.tags.length?e.tags.join("、"):null,"dTag");
  const rel=document.getElementById("dRel"); rel.innerHTML="";
  document.getElementById("secRel").style.display=e.related.length?"":"none";
  e.related.forEach(name=>{
    const b=document.createElement("button"); b.textContent=name;
    b.addEventListener("click",()=>jumpTo(name));
    rel.appendChild(b);
  });
  document.getElementById("dSrc").textContent=e.wikiSlug?("wiki 溯源："+e.wikiSlug):"wiki 溯源：尚未归档";
  drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false");
  overlay.hidden=false;
}
function toggle(secId,val,txtId){
  document.getElementById(secId).style.display=val?"":"none";
  if(val)document.getElementById(txtId).textContent=val;
}
function closeDrawer(){drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");overlay.hidden=true}
document.getElementById("dClose").addEventListener("click",closeDrawer);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer()});

/* ---- related 跳转 + 闪烁 ---- */
function jumpTo(title){
  const idx=EVENTS.findIndex(e=>e.title===title);
  if(idx<0)return;
  closeDrawer();
  if(typeof switchView==="function") switchView("timeline");
  const row=document.querySelector('.row[data-idx="'+idx+'"]');
  if(!row)return;
  row.style.display="";
  row.scrollIntoView({block:"center"});
  row.classList.remove("flash"); void row.offsetWidth;
  row.classList.add("flash");
  setTimeout(()=>row.classList.remove("flash"),1500);
}

/* ---- 回到当前章节浮动按钮 ---- */
const toBand=document.getElementById("toBand");
const bands=[...document.querySelectorAll(".band")];
let curBand=bands[0]||null;
function trackBand(){
  const tlVisible=!document.getElementById("view-timeline").hidden;
  const mark=window.scrollY+window.innerHeight*0.5;
  let best=null;
  bands.forEach(b=>{ if(b.getBoundingClientRect().top+window.scrollY<=mark) best=b; });
  if(best) curBand=best;
  toBand.hidden=!tlVisible||!curBand||window.scrollY<30;
}
window.addEventListener("scroll",trackBand,{passive:true});
window.addEventListener("resize",trackBand);
trackBand();
toBand.addEventListener("click",()=>{
  if(!curBand) return;
  curBand.scrollIntoView({block:"start"});
  curBand.classList.remove("flash"); void curBand.offsetWidth;
  curBand.classList.add("flash");
  setTimeout(()=>curBand.classList.remove("flash"),1500);
});
