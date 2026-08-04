/* review.js — 复习模式：设置界面、三模式（针对训练/巩固错题/随机漫游）、错题重练 */
'use strict';

let rvInit=false, rvState=null;
let rvSeg='ancient';   /* 复习史段（第一步）：ancient/modern；world 占位 disabled（2026-08-05） */
const rvCfg={type:new Set(), imp:new Set(), per:new Set(), q:'', numMode:'all', num:10, mode:'train', roamScope:'all'};

function initReview(){
  if(rvInit) return; rvInit=true;
  /* 第一步：史段选择（ancient/modern；world 占位 disabled，规划中） */
  document.getElementById("rvSegBtns").querySelectorAll(".rv-mode-btn").forEach(b=>{
    if(b.disabled) return;
    b.addEventListener("click",()=>{
      rvSeg=b.dataset.seg;
      document.getElementById("rvSegBtns").querySelectorAll(".rv-mode-btn").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      rvCfg.per.clear();                 /* 分期随史段重建，清旧选择 */
      renderRvPer();
      rvSyncBtns(); updateCount();
    });
  });
  /* 门类/等第：多选 toggle（「全部」=清空该组）；分期按史段动态生成 */
  rvBtns(document.getElementById("rvTypeBtns"),[["全部","全部"],["政治","政治"],["军事","军事"],["经济","经济"],["文化","文化"],["制度","制度"],["民族关系","民族关系"],["对外关系","对外关系"]],"type");
  rvBtns(document.getElementById("rvImpBtns"),[["全部",0],["★★★",3],["★★",2],["★",1]],"imp");
  renderRvPer();
  document.getElementById("rvQ").addEventListener("input",e=>{rvCfg.q=e.target.value.trim();updateCount();});
  document.getElementById("rvAll").addEventListener("click",()=>{rvCfg.numMode="all";document.getElementById("rvAll").classList.add("on");document.getElementById("rvNum").disabled=true;});
  document.getElementById("rvNum").addEventListener("input",e=>{
    rvCfg.numMode="num";rvCfg.num=Math.max(1,parseInt(e.target.value)||10);
    document.getElementById("rvAll").classList.remove("on");document.getElementById("rvNum").disabled=false;
  });
  document.getElementById("rvModes").querySelectorAll(".rv-mode-btn").forEach(b=>{
    b.addEventListener("click",()=>{document.getElementById("rvModes").querySelectorAll(".rv-mode-btn").forEach(x=>x.classList.remove("on"));b.classList.add("on");rvCfg.mode=b.dataset.mode;
      /* 随机漫游：显示漫游范围（全随机/选史段随机） */
      document.getElementById("rvRoamScope").hidden=b.dataset.mode!=="roam";
      updateCount();
    });
  });
  /* 漫游范围：全随机（全部史段）/ 选史段随机（第一步所选） */
  document.getElementById("rvScopeBtns").querySelectorAll("button.f").forEach(b=>{
    b.addEventListener("click",()=>{
      rvCfg.roamScope=b.dataset.scope;
      document.getElementById("rvScopeBtns").querySelectorAll("button.f").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      updateCount();
    });
  });
  document.getElementById("rvStart").addEventListener("click",startReview);
  document.getElementById("rvShow").addEventListener("click",()=>{
    document.getElementById("rvCard").classList.add("flip");
    document.getElementById("rvShow").hidden=true;
    const roam=rvState.mode==="roam";
    document.getElementById("rvFail").hidden=roam;
    document.getElementById("rvOk").hidden=roam;
    document.getElementById("rvNext").hidden=!roam;
  });
  document.getElementById("rvFail").addEventListener("click",()=>answer(false));
  document.getElementById("rvOk").addEventListener("click",()=>answer(true));
  document.getElementById("rvNext").addEventListener("click",()=>{const s=rvState;s.queue.shift();s.processed++;s.roundDone++;showCard();});
  document.getElementById("rvAgain").addEventListener("click",()=>showSetup());
  const rvExit=document.getElementById("rvExit");
  let exitArmed=false, exitTimer=null;
  rvExit.addEventListener("click",()=>{
    if(!exitArmed){
      exitArmed=true; rvExit.textContent="确认退出？"; rvExit.classList.add("armed");
      exitTimer=setTimeout(()=>{exitArmed=false;rvExit.textContent="退出";rvExit.classList.remove("armed");},3000);
      return;
    }
    clearTimeout(exitTimer); exitArmed=false;
    rvExit.textContent="退出"; rvExit.classList.remove("armed");
    showSetup();
  });
  showSetup();
  updateCount();
}

/* 复习筛选按钮：多选 toggle（「全部」= 清空该组；空 Set = 全部）；key 为 rvCfg 字段名 */
function rvBtns(el,items,key){
  el.innerHTML="";
  items.forEach(it=>{
    const label=it[0], val=it[1];
    const b=document.createElement("button");
    b.className="f"; b.textContent=label; b.dataset.val=String(val);
    if(val==="全部"||val===0){
      b.addEventListener("click",()=>{rvCfg[key].clear();rvSyncBtns();updateCount();});
    }else{
      b.addEventListener("click",()=>{rvCfg[key].has(val)?rvCfg[key].delete(val):rvCfg[key].add(val);rvSyncBtns();updateCount();});
    }
    el.appendChild(b);
  });
  rvSyncBtns();
}
/* 分期按钮：按第一步所选史段重建（ancient=15 章 / modern=11 段） */
function renderRvPer(){
  const CH=rvSeg==="modern"?CHAPTERS_MODERN:CHAPTERS;
  rvBtns(document.getElementById("rvPerBtns"),[["全部","全部"],...CH.map((c,i)=>[c.name,i])],"per");
}
/* 按钮高亮同步：「全部」on = Set 空；具体项 on = 在 Set 中（type 字符串 / imp·per 数字） */
function rvSyncBtns(){
  for(const [gid,key,conv] of [["rvTypeBtns","type",s=>s],["rvImpBtns","imp",Number],["rvPerBtns","per",Number]]){
    const g=document.getElementById(gid); if(!g) continue;
    const s=rvCfg[key];
    g.querySelectorAll("button.f").forEach(b=>{
      if(b.textContent==="全部"){ b.classList.toggle("on", s.size===0); return; }
      b.classList.toggle("on", s.has(conv(b.dataset.val)));
    });
  }
}

/* 数据源：按史段；随机漫游「全随机」= 全库（ancient+modern 合并） */
function rvEvents(){
  if(rvCfg.mode==="roam" && rvCfg.roamScope==="all") return [...EVENTS, ...EVENTS_MODERN];
  return rvSeg==="modern"?EVENTS_MODERN:EVENTS;
}

function poolFromFilters(){
  const EV=rvEvents();
  const allScope=(rvCfg.mode==="roam" && rvCfg.roamScope==="all");
  const q=rvCfg.q.toLowerCase();
  return EV.filter(e=>{
    if(rvCfg.type.size && !rvCfg.type.has(e.type)) return false;
    if(rvCfg.imp.size && !rvCfg.imp.has(e.importance)) return false;
    if(!allScope && rvCfg.per.size && !rvCfg.per.has(e.ch)) return false;  /* 全随机忽略分期（跨史段 ch 冲突） */
    if(q && !matchEvent(e,q)) return false;
    return true;
  });
}

function wrongPool(){
  const EV=rvSeg==="modern"?EVENTS_MODERN:EVENTS;
  const key="ht-review-"+rvSeg+"-";
  return EV.filter(e=>localStorage.getItem(key+e.title)==="fail" || localStorage.getItem("ht-review-"+e.title)==="fail");  /* 兼容旧无前缀 key */
}

function updateCount(){
  document.getElementById("rvCount").textContent="当前范围共 "+poolFromFilters().length+" 题";
}

function showSetup(){
  document.getElementById("rvSetup").style.display="";
  document.getElementById("rvStage").style.display="none";
  document.getElementById("rvDone").hidden=true;
  document.getElementById("rvWarn").hidden=true;
}

function startReview(){
  const warn=document.getElementById("rvWarn");
  let pool;
  if(rvCfg.mode==="wrong"){
    pool=wrongPool();
    if(pool.length===0){warn.textContent="暂无错题，先去「针对训练」练几轮。";warn.hidden=false;return;}
  }else{
    pool=poolFromFilters();
    if(pool.length===0){warn.textContent="该范围内没有题目，请调整筛选条件。";warn.hidden=false;return;}
    const max=rvCfg.numMode==="all"?pool.length:Math.min(rvCfg.num,pool.length);
    shuffle(pool); pool=pool.slice(0,max);
  }
  pool=pool.map(e=>({e})); /* 统一包装为 {e}，供 showCard/answer 使用 */
  rvState={queue:pool,fails:[],processed:0,total:pool.length,round:1,okCount:0,failCount:0,mode:rvCfg.mode,roundTotal:pool.length,roundDone:0,seg:rvSeg};
  document.getElementById("rvSetup").style.display="none";
  document.getElementById("rvStage").style.display="";
  document.getElementById("rvDone").hidden=true;
  showCard();
}

/* V3：复习卡片背面年份——era 显示时代段；公元后 exact/approx 补"年"单位；其余（前 X / range）沿用 fmt */
function rvYearFmt(e){
  if(e.yearMode==="era") return e.era? (e.era+(e.eraSub?" · "+e.eraSub:"")) : (e.dynasty||e.period||"时代");
  const s=fmt(e);
  if(e.year>0 && (e.yearMode==="exact"||e.yearMode==="approx")) return s+" 年";
  return s;
}

function showCard(){
  const s=rvState;
  if(s.queue.length===0){
    if(s.mode!=="roam"&&s.fails.length>0){s.queue=s.fails;s.fails=[];s.round++;s.roundTotal=s.queue.length;s.roundDone=0;showCard();return;}
    finishRound();return;
  }
  s.cur=s.queue[0];
  document.getElementById("rvTitle").textContent=s.cur.e.title;
  document.getElementById("rvFrontTags").innerHTML='<span class="tag"></span><span class="stars">'+stars(s.cur.e.importance)+'</span>';
  document.getElementById("rvFrontTags").querySelector(".tag").textContent=s.cur.e.type;  /* XSS 加固 */
  /* V3：背面年份展示——公元后 exact/approx 补"年"单位（"69"→"69 年"），避免裸数字像页码 */
  document.getElementById("rvYear").textContent=rvYearFmt(s.cur.e);
  document.getElementById("rvSum").textContent=s.cur.e.summary||"";
  const tip=document.getElementById("rvTip");
  if(s.cur.e.examTip){tip.style.display="";tip.textContent=s.cur.e.examTip;}else{tip.style.display="none";}
  const kv=[];
  if(s.cur.e.location)kv.push("地点："+s.cur.e.location);
  if(s.cur.e.people&&s.cur.e.people.length)kv.push("人物："+s.cur.e.people.join("、"));
  document.getElementById("rvKv").textContent=kv.join("　");
  document.getElementById("rvCard").classList.remove("flip");
  document.getElementById("rvShow").hidden=false;
  document.getElementById("rvFail").hidden=true;
  document.getElementById("rvOk").hidden=true;
  document.getElementById("rvNext").hidden=true;
  updateProg();
}

function updateProg(){
  const s=rvState;
  const rt=s.roundTotal||s.total;
  document.getElementById("rvProg").textContent=(s.mode==="roam"?"漫游":(s.mode==="wrong"?"错题":"训练"))+" 第 "+Math.min(s.roundDone+1,rt)+" / "+rt+" 张";
  document.getElementById("rvFails").textContent=s.mode==="roam"?"不计错题":((s.failCount>0?("错题 "+s.failCount+" · "):"")+(s.round>1?("第 "+s.round+" 轮"):""));
  document.getElementById("rvBarIn").style.width=(s.processed/s.total*100)+"%";
}

function answer(ok){
  const s=rvState;
  const card=s.queue.shift();
  s.processed++; s.roundDone++;
  const key="ht-review-"+(s.seg||"ancient")+"-"+card.e.title;   /* 错题 key 加史段前缀（ancient/modern 互不混淆） */
  if(ok){s.okCount++;localStorage.setItem(key,"ok");}
  else{s.failCount++;s.fails.push(card);localStorage.setItem(key,"fail");}
  showCard();
}

function finishRound(){
  const s=rvState;
  document.getElementById("rvStage").style.display="none";
  document.getElementById("rvDone").hidden=false;
  const stat=document.getElementById("rvDoneStat");
  if(s.mode==="roam"){stat.textContent="共 "+s.total+" 张 · 随机漫游完成";}
  else{stat.textContent="共 "+s.total+" 张 · 记住 "+s.okCount+" · 错题重练 "+s.failCount+" 次";}
  document.getElementById("rvBarIn").style.width="100%";
}
