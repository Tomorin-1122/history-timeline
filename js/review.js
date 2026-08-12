/* review.js — 复习模式：设置界面、三模式 + 题型专练（quiz）、错题重练 */
'use strict';

let rvInit=false, rvState=null;
let rvSeg='ancient';   /* 复习史段（第一步）：ancient/modern/world-ancient/world-modern（世界史 2026-08-05 接入） */
const rvCfg={type:new Set(), imp:new Set(), per:new Set(), q:'', numMode:'all', num:10, mode:'train', roamScope:'all', qz:'judge'};

function initReview(){
  if(rvInit) return; rvInit=true;
  renderRvSegCounts();
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
      /* 随机漫游：显示漫游范围（全随机/选史段随机）；题型专练：显示题型选择 */
      document.getElementById("rvRoamScope").hidden=b.dataset.mode!=="roam";
      document.getElementById("rvQuizSec").hidden=b.dataset.mode!=="quiz";
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
  /* 题型选择（quiz）：P1 仅判断题，其余 disabled 占位 */
  document.getElementById("rvQuizTypes").querySelectorAll("button.f").forEach(b=>{
    if(b.disabled) return;
    b.addEventListener("click",()=>{
      rvCfg.qz=b.dataset.qz;
      document.getElementById("rvQuizTypes").querySelectorAll("button.f").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
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
/* 复习史段数据源：与时间轴 segData 同构（world 4+4 分段 ch 归一化）；rvSegDataFor 显式指定史段 */
function rvSegDataFor(seg){
  if(seg==="world-ancient") return {EV: EVENTS_WORLD.filter(e=>e.ch<4), CH: CHAPTERS_WORLD.slice(0,4)};
  if(seg==="world-modern")  return {EV: EVENTS_WORLD.filter(e=>e.ch>=4).map(e=>({...e,ch:e.ch-4})), CH: CHAPTERS_WORLD.slice(4)};
  if(seg==="modern") return {EV: EVENTS_MODERN, CH: CHAPTERS_MODERN};
  return {EV: EVENTS, CH: CHAPTERS};
}
function rvSegData(){ return rvSegDataFor(rvSeg); }
/* 史段按钮条数动态填充（数据量变化免手改 index.html 硬编码文案） */
function renderRvSegCounts(){
  const unit={ancient:"章",modern:"段","world-ancient":"段","world-modern":"段"};
  for(const seg of Object.keys(unit)){
    const el=document.getElementById("rvSegN-"+seg);
    if(!el) continue;
    const {EV,CH}=rvSegDataFor(seg);
    el.textContent=CH.length+" "+unit[seg]+" · "+EV.length+" 事";
  }
}
/* 分期按钮：按第一步所选史段重建（ancient=15 章 / modern=11 段 / world-*=4 段） */
function renderRvPer(){
  const {CH}=rvSegData();
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

/* 数据源：按史段；随机漫游「全随机」= 全库（古代+近代+世界史合并） */
function rvEvents(){
  if(rvCfg.mode==="roam" && rvCfg.roamScope==="all") return [...EVENTS, ...EVENTS_MODERN, ...EVENTS_WORLD];
  return rvSegData().EV;
}

function poolFromFilters(EV){
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

/* 错题池：当前史段历史标「fail」的题，同样套用门类/等第/分期/搜索筛选（与针对训练一致） */
function wrongPool(){
  const EV=rvSegData().EV;
  const key="ht-review-"+rvSeg+"-";
  const fails=EV.filter(e=>localStorage.getItem(key+e.title)==="fail" || localStorage.getItem("ht-review-"+e.title)==="fail");  /* 兼容旧无前缀 key */
  return poolFromFilters(fails);
}

function updateCount(){
  const pool=rvCfg.mode==="wrong" ? wrongPool() : poolFromFilters(rvEvents());
  document.getElementById("rvCount").textContent="当前范围共 "+pool.length+" 题";
}

function showSetup(){
  rvState=null;   /* 结束本轮：退出/再来一轮/切史段后 rvState 归零，避免误弹"复习进行中" */
  document.getElementById("rvSetup").style.display="";
  document.getElementById("rvStage").style.display="none";
  document.getElementById("rvDone").hidden=true;
  document.getElementById("rvWarn").hidden=true;
}

function startReview(){
  const warn=document.getElementById("rvWarn");
  let cards;
  if(rvCfg.mode==="quiz"){
    /* 题型专练：判断题 / 选择题甲种 / 排序题。判断/选择复用筛选池；排序题按核心链出题（忽略筛选） */
    const max=rvCfg.numMode==="all"?10:Math.min(rvCfg.num,10);
    let qz=[];
    if(rvCfg.qz==="judge"){
      const src=poolFromFilters(rvEvents());
      if(src.length<2){warn.textContent="该范围内题目太少，请调整筛选条件。";warn.hidden=false;return;}
      qz=genJudgment(src,Math.min(max,src.length));
    }else if(rvCfg.qz==="choiceA"){
      const src=poolFromFilters(rvEvents());
      if(src.length<2){warn.textContent="该范围内题目太少，请调整筛选条件。";warn.hidden=false;return;}
      qz=genChoiceA(src,Math.min(max,src.length));
    }else if(rvCfg.qz==="sort"){
      qz=genSorting(max);
    }
    if(qz.length===0){warn.textContent="该范围内无法生成题目，请扩大范围或换题型。";warn.hidden=false;return;}
    cards=qz.map(x=>({quiz:x}));   /* 包装为 {quiz}，与 {e} 区分 */
  }else{
    let pool;
    if(rvCfg.mode==="wrong"){
      pool=wrongPool();
      if(pool.length===0){warn.textContent="暂无错题，先去「针对训练」练几轮。";warn.hidden=false;return;}
    }else{
      pool=poolFromFilters(rvEvents());
      if(pool.length===0){warn.textContent="该范围内没有题目，请调整筛选条件。";warn.hidden=false;return;}
      const max=rvCfg.numMode==="all"?pool.length:Math.min(rvCfg.num,pool.length);
      shuffle(pool); pool=pool.slice(0,max);
    }
    cards=pool.map(e=>({e}));
  }
  rvState={queue:cards,fails:[],processed:0,total:cards.length,round:1,okCount:0,failCount:0,mode:rvCfg.mode,qz:rvCfg.qz,roundTotal:cards.length,roundDone:0,seg:rvSeg};
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
  const isQz=s.mode==="quiz";
  document.getElementById("rvCard").style.display=isQz?"none":"";
  document.getElementById("rvQuiz").hidden=!isQz;
  document.querySelector("#rvStage .rv-actions").hidden=isQz;
  if(isQz){ renderQuizCard(s.cur.quiz); updateProg(); return; }
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
  const mn=s.mode==="quiz"?(s.qz==="judge"?"判断题":(s.qz==="choiceA"?"选择题":(s.qz==="sort"?"排序题":"题型"))):(s.mode==="roam"?"漫游":(s.mode==="wrong"?"错题":"训练"));
  document.getElementById("rvProg").textContent=mn+" 第 "+Math.min(s.roundDone+1,rt)+" / "+rt+" 张";
  document.getElementById("rvFails").textContent=s.mode==="roam"?"不计错题":((s.failCount>0?("错题 "+s.failCount+" · "):"")+(s.round>1?("第 "+s.round+" 轮"):""));
  document.getElementById("rvBarIn").style.width=(s.processed/s.total*100)+"%";
}

/* ---- 题型专练（quiz）答题：选择即判（无翻牌） ---- */
/* 判题结果记录（judge/choiceA/sort 共用）：写错题 key、计数、进 fails、出反馈 */
function recordQuizResult(ok,pick){
  const s=rvState, cur=s.cur.quiz;
  const key="ht-review-qz-"+(s.seg||"ancient")+"-"+cur.hash;   /* 错题 key：题型独立，不复用事件错题 */
  if(ok){s.okCount++;localStorage.setItem(key,"ok");}
  else{s.failCount++;s.fails.push(s.cur);localStorage.setItem(key,"fail");}
  s.processed++; s.roundDone++;
  showQuizResult(ok,pick);
  updateProg();
}
function quizAnswer(pick){
  recordQuizResult(pick===rvState.cur.quiz.answer, pick);
}
function submitSort(){
  const s=rvState, picks=s.cur._picks||[];
  recordQuizResult(picks.join("|")===s.cur.quiz.order.join("|"));
}
function quizNext(){
  const s=rvState;
  s.queue.shift();
  showCard();
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
  rvState=null;   /* 本轮收敛：已完成无需再占用 rvState（切史段不再误弹"复习进行中"） */
}
