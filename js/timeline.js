/* timeline.js — 时间轴视图：章节带 + 事件行渲染、筛选/搜索联动、详情抽屉、章节回顶 */
'use strict';

const TYPES=["全部","政治","军事","经济","文化","制度","民族关系","对外关系"];
const IMPS=[["全部",0],["★★★",3],["★★",2],["★",1]];
const state={type:"全部",imp:0,q:"",ch:-1};

/* ---- 渲染：全 15 章章节带 + 事件行（空章占位） ---- */
/* era 事件排序键：有 year 用 year；eraSub"距今约X万年"解析为负年（800万年→-8000000）参与排序；
   无任何时间信息才排章末（修复：万年事件曾被一律排章末，与时间序倒挂） */
function eraSortKey(e){
  if(e.year != null) return e.year;
  const m=String(e.eraSub||"").match(/距今约?([\d.]+)\s*万/);
  return m ? -Math.round(parseFloat(m[1])*10000) : 1e9;
}

const main=document.getElementById("main");
CHAPTERS.forEach((c,ci)=>{
  const band=document.createElement("div");
  band.className="band"; band.id=c.id;
  band.innerHTML='<span class="sq"></span><span class="no">'+c.no+'</span><h2>'+c.name+'</h2><span class="note">'+c.note+'</span><span class="rule"></span>';
  main.appendChild(band);
  const rowsInCh=EVENTS.map((e,i)=>({e,i})).filter(x=>x.e.ch===ci)
    .sort((a,b)=> eraSortKey(a.e)-eraSortKey(b.e) || ((a.e.month||13)-(b.e.month||13)));  /* eraSub 万年解析排序 */
  if(rowsInCh.length===0){
    const empty=document.createElement("div");
    empty.className="row";
    empty.innerHTML='<div class="year"></div><div class="body"><div class="summary" style="color:var(--ink3)">（数据待生成）</div></div>';
    main.appendChild(empty);
    return;
  }
  rowsInCh.forEach(({e, i: idx})=>{   /* 解构重命名：map 产 {e,i}，idx 取 i（此前写 {e,idx} 导致 idx=undefined） */
    const row=document.createElement("div");
    row.className="row "+e.yearMode; row.dataset.idx=idx; row.dataset.type=e.type; row.dataset.imp=e.importance;
    const yr=document.createElement("div"); yr.className="year";
    if(e.yearMode==="era"){
      const span=document.createElement("span"); span.className="era";
      if(e.era){
        span.textContent=e.era;
        if(e.eraSub){ span.appendChild(document.createElement("br")); span.appendChild(document.createTextNode(e.eraSub)); }
      }else span.textContent=e.dynasty||e.period||'时代';  /* Q4 回填前暂显朝代 */
      yr.appendChild(span);
    }else{
      yr.textContent=fmtShort(e);
    }
    const body=document.createElement("div"); body.className="body";
    /* 数据字段一律 textContent（XSS 加固）：stars 为受控 HTML，title/type/summary 走文本节点 */
    const tr=document.createElement("div"); tr.className="title-row";
    tr.innerHTML='<span class="stars">'+stars(e.importance)+'</span>';
    const h=document.createElement("h3"); h.textContent=e.title; tr.appendChild(h);
    const tag=document.createElement("span"); tag.className="tag"; tag.textContent=e.type; tr.appendChild(tag);
    const sum=document.createElement("div"); sum.className="summary"; sum.textContent=e.summary;
    body.appendChild(tr); body.appendChild(sum);
    body.addEventListener("click",()=>openDrawer(idx));
    yr.addEventListener("click",()=>openDrawer(idx));
    row.appendChild(yr); row.appendChild(body);
    main.appendChild(row);
  });
});

/* ---- 分期筛选链接（按 CHAPTERS 动态生成；地图界面点按章过滤） ---- */
(function(){
  const perGroup=document.getElementById("perGroup");
  if(!perGroup) return;
  const all=document.createElement("a");
  all.className="jump on"; all.href="#"; all.textContent="全部"; all.dataset.ch="-1";
  perGroup.appendChild(all);
  CHAPTERS.forEach((c,i)=>{
    const a=document.createElement("a");
    a.className="jump"; a.href="#"+c.id; a.textContent=c.name; a.dataset.ch=i;
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
/* B2：footer 数据量动态生成（读 EVENTS/CHAPTERS，改数据后无需手动同步） */
const footStat=document.getElementById("footStat");
if(footStat) footStat.textContent="全 "+CHAPTERS.length+" 章 · "+EVENTS.length+" 事";

/* ---- 详情抽屉 ---- */
const drawer=document.getElementById("drawer");
const overlay=document.getElementById("overlay");
function openDrawer(idx){
  const e=EVENTS[idx];
  document.getElementById("dYear").textContent=e.yearMode==="era"
    ? (e.era? (e.era+(e.eraSub?" · "+e.eraSub:"")) : (e.dynasty||e.period||"时代"))
    : fmt(e);
  document.getElementById("dTitle").textContent=e.title;
  document.getElementById("dMeta").innerHTML='<span class="tag"></span><span class="tag"></span><span class="tag"></span><span class="stars">'+stars(e.importance)+'</span>';
  /* XSS 加固：dynasty/period/type 数据字段走 textContent */
  const dMetaTags=document.getElementById("dMeta").querySelectorAll("span.tag");
  dMetaTags[0].textContent=e.dynasty; dMetaTags[1].textContent=e.period; dMetaTags[2].textContent=e.type;
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
const toNextBand=document.getElementById("toNextBand");
const bands=[...document.querySelectorAll(".band")];
let curBand=bands[0]||null;
function trackBand(){
  const tlVisible=!document.getElementById("view-timeline").hidden;
  const mark=window.scrollY+window.innerHeight*0.5;
  let best=null;
  bands.forEach(b=>{ if(b.getBoundingClientRect().top+window.scrollY<=mark) best=b; });
  if(best) curBand=best;
  toBand.hidden=!tlVisible||!curBand||window.scrollY<30;
  /* ↓ 按钮：有下一章时才显示 */
  const idx=curBand?bands.indexOf(curBand):-1;
  toNextBand.hidden=!tlVisible||idx<0||idx>=bands.length-1||window.scrollY<30;
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
toNextBand.addEventListener("click",()=>{
  const idx=curBand?bands.indexOf(curBand):-1;
  const next=idx>=0?bands[idx+1]:null;
  if(!next) return;
  next.scrollIntoView({block:"start"});
  next.classList.remove("flash"); void next.offsetWidth;
  next.classList.add("flash");
  setTimeout(()=>next.classList.remove("flash"),1500);
});
