/* timeline.js — 时间轴视图：章节带 + 事件行渲染、筛选/搜索联动、详情抽屉、章节回顶 */
'use strict';

const TYPES=["全部","政治","军事","经济","文化","制度","民族关系","对外关系"];
const IMPS=[["全部",0],["★★★",3],["★★",2],["★",1]];
const state={type:"全部",imp:0,q:"",ch:-1};
/* ---- 史段（交接文档 §10.6.2）---- */
let curSeg="ancient";  /* 'ancient' | 'modern' | 'world-ancient'(禁用) | 'world-modern'(禁用) */
function segName(seg){return seg==="modern"?"中国近现代史":(seg==="world-ancient"?"世界古代中世纪史":(seg==="world-modern"?"世界近现代史":"中国古代史"));}
function segPending(seg){
  if(seg==="modern") return "近代史数据已提取（第01-07章 297 条），清洗接入数据管道后上线。";
  return "内容规划中，敬请期待。";
}
/* ---- 章节带引用（↑↓ 浮动按钮用）：renderTimeline() 重渲染后由 refreshBands() 刷新（史段切换销毁旧 DOM）---- */
const toBand=document.getElementById("toBand");
const toNextBand=document.getElementById("toNextBand");
let bands=[];
let curBand=null;

/* ---- 渲染：全 15 章章节带 + 事件行（空章占位） ---- */
/* era 事件排序键：有 year 用 year；range 取 yearRange[0]；eraSub"距今X万年"解析为负年；
   eraSub"约前X年"解析为负年；era 分期名走 ERA_ORDER 映射；无任何时间信息才排章末
   （修复：eraSub 为空的 era 事件曾被一律排章末——夏商章商代 exact 事件排到夏代 era 事件前面） */
const ERA_ORDER = {
  /* 原始社会/传说（估算年，仅排序用） */
  '腊玛古猿阶段': -8000000, '旧石器时代早期': -1000000, '旧石器时代中期': -200000, '旧石器时代晚期': -50000,
  '中石器至新石器时代': -12000, '新石器时代': -8000, '原始社会后期': -5000,
  '父系氏族社会': -4000, '父系氏族社会（龙山文化时期）': -3500,
  '传说时代': -3000, '传说时代（部落联盟时期）': -2600, '传说时代（军事民主制时期）': -2400, '传说时代末期': -2300,
  /* 夏商 */
  '夏代初年': -2070, '夏代前期': -2000, '夏代': -1900, '夏代中晚期': -1750, '夏代后期': -1680,
  '商族兴起时期': -1900, '夏商之际': -1620, '商代初期': -1580, '商代中期': -1400,
  '商代': -1350, '商代（青铜文明鼎盛）': -1300, '商代晚期（武丁时期）': -1250, '商代后期': -1150, '商代末期': -1060,
  /* 西周 */
  '周武王时期': -1046, '西周初年': -1040, '西周成王时期': -1030, '周穆王时期': -960, '西周共王时期': -900, '西周时期': -950,
  /* 春秋（诸侯纪年取在位代表） */
  '秦穆公时期': -650, '楚庄王时期': -610, '吴王阖闾时期': -510, '吴王夫差时期': -490, '越王勾践时期': -480,
  '春秋时期': -720, '春秋中后期': -560, '春秋末期': -490, '春秋末期至战国初年': -475,
  /* 战国 */
  '战国初期': -450, '战国中期': -350, '战国时期': -300, '战国后期': -260,
  /* 秦汉 */
  '秦代': -220, '西汉': -150, '西汉中期': -120, '西汉后期': -60,
  '东汉初期': 30, '东汉前期': 50, '东汉明章时期': 70, '东汉': 120, '东汉顺帝时期': 135, '东汉灵帝时期': 180, '东汉末年': 190,
  /* 魏晋南北朝 */
  '魏晋': 250, '东晋': 340, '魏晋南北朝': 400, '东晋南朝': 420,
  /* 隋唐 */
  '隋代': 600, '隋炀帝时期': 610, '唐初': 630, '盛唐': 740, '盛唐至中唐': 770, '中唐': 800, '唐代': 720,
  /* 五代两宋 */
  '北宋初期': 960, '北宋': 1030, '北宋中期': 1060, '两宋时期': 1100, '两宋': 1120,
  /* 元 */
  '蒙古国时期（13世纪）': 1230, '元朝初年': 1275, '元世祖时期': 1285, '元代': 1300, '元朝': 1320,
  /* 明 */
  '明初': 1370, '明代中期': 1500, '明代': 1500, '明代中后期': 1550, '万历年间': 1590, '明代后期': 1610, '天启年间': 1625,
  /* 清 */
  '明末清初': 1645, '清初': 1650, '清前期': 1690, '康熙年间': 1690, '康熙雍正年间': 1710, '康雍乾时期': 1725,
  '康熙至乾隆年间': 1730, '清前期至中期': 1730, '清代中期': 1750, '乾隆年间': 1760, '乾隆嘉庆年间': 1775, '清代前期': 1700,
};
function eraSortKey(e){
  if(e.year != null) return e.year;
  if(Array.isArray(e.yearRange) && e.yearRange.length) return e.yearRange[0];   /* range 取起点（武丁中兴 -1250） */
  const m=String(e.eraSub||"").match(/距今约?([\d.]+)\s*万/);
  if(m) return -Math.round(parseFloat(m[1])*10000);
  const y=String(e.eraSub||"").match(/约?前\s*([\d.]+)\s*年/);
  if(y) return -Math.round(parseFloat(y[1]));
  const ev=(e.era||"").trim();
  if(ev && ERA_ORDER[ev]!=null) return ERA_ORDER[ev];
  return 1e9;
}

const main=document.getElementById("main");
function renderTimeline(){
  main.innerHTML="";
  if(curSeg!=="ancient"){  /* 近代史/世界史数据未接入：占位提示（顶栏已预留，数据接入后替换此分支） */
    const ph=document.createElement("div");
    ph.className="band";
    ph.innerHTML='<span class="sq"></span><span class="no">--</span><h2>'+segName(curSeg)+'</h2><span class="note">数据接入中</span><span class="rule"></span>';
    main.appendChild(ph);
    const row=document.createElement("div");
    row.className="row";
    const bd=document.createElement("div"); bd.className="body";
    const sum=document.createElement("div"); sum.className="summary"; sum.style.color="var(--ink3)"; sum.textContent=segPending(curSeg);
    bd.appendChild(sum);
    row.appendChild(document.createElement("div")); row.appendChild(bd);
    main.appendChild(row);
    refreshBands();  /* 刷新 ↑↓ 的 bands 引用与显示状态 */
    return;
  }
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
  refreshBands();  /* 刷新 ↑↓ 的 bands 引用与显示状态（史段切换/重渲染后旧 DOM 已销毁） */
}
renderTimeline();

/* ---- 分期筛选链接（按 CHAPTERS 动态生成；地图界面点按章过滤；史段切换重建） ---- */
function renderPerLinks(){
  const perGroup=document.getElementById("perGroup");
  if(!perGroup) return;
  perGroup.innerHTML="";
  if(curSeg!=="ancient"){  /* 非古代史：分期占位（数据接入后按史段渲染 period 链接） */
    const span=document.createElement("span");
    span.className="glabel"; span.textContent=curSeg==="modern"?"近代史分期（11 段）待接入":"分期待定";
    perGroup.appendChild(span);
    return;
  }
  const all=document.createElement("a");
  all.className="jump on"; all.href="#"; all.textContent="全部"; all.dataset.ch="-1";
  perGroup.appendChild(all);
  CHAPTERS.forEach((c,i)=>{
    const a=document.createElement("a");
    a.className="jump"; a.href="#"+c.id; a.textContent=c.name; a.dataset.ch=i;
    perGroup.appendChild(a);
  });
}
renderPerLinks();

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
  if(curSeg!=="ancient"){  /* 非古代史：数据未接入，计数占位 */
    document.getElementById("cnt").textContent="共 0 事";
    document.getElementById("empty").hidden=true;
    return;
  }
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
function refreshBands(){
  bands=[...main.querySelectorAll(".band")];
  if(curBand && !bands.includes(curBand)) curBand=null;  /* 旧引用已销毁 → 重置 */
  trackBand();
}
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
