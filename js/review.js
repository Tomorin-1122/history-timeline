/* review.js — 复习模式：设置界面、三模式（针对训练/巩固错题/随机漫游）、错题重练 */
'use strict';

let rvInit=false, rvState=null;
const rvCfg={type:"全部",imp:0,per:"全部",q:"",numMode:"all",num:10,mode:"train"};

function initReview(){
  if(rvInit) return; rvInit=true;
  rvBtns(document.getElementById("rvTypeBtns"),[["全部","全部"],["政治","政治"],["军事","军事"],["经济","经济"],["文化","文化"],["制度","制度"],["民族关系","民族关系"],["对外关系","对外关系"]],v=>{rvCfg.type=v;updateCount();},"全部");
  rvBtns(document.getElementById("rvImpBtns"),[["全部",0],["★★★",3],["★★",2],["★",1]],v=>{rvCfg.imp=v;updateCount();},0);
  rvBtns(document.getElementById("rvPerBtns"),[["全部","全部"],...CHAPTERS.map((c,i)=>[c.name,i])],v=>{rvCfg.per=v;updateCount();},"全部");
  document.getElementById("rvQ").addEventListener("input",e=>{rvCfg.q=e.target.value.trim();updateCount();});
  document.getElementById("rvAll").addEventListener("click",()=>{rvCfg.numMode="all";document.getElementById("rvAll").classList.add("on");document.getElementById("rvNum").disabled=true;});
  document.getElementById("rvNum").addEventListener("input",e=>{
    rvCfg.numMode="num";rvCfg.num=Math.max(1,parseInt(e.target.value)||10);
    document.getElementById("rvAll").classList.remove("on");document.getElementById("rvNum").disabled=false;
  });
  document.getElementById("rvModes").querySelectorAll(".rv-mode-btn").forEach(b=>{
    b.addEventListener("click",()=>{document.getElementById("rvModes").querySelectorAll(".rv-mode-btn").forEach(x=>x.classList.remove("on"));b.classList.add("on");rvCfg.mode=b.dataset.mode;});
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

function rvBtns(el,items,onChange,active){
  el.innerHTML="";
  items.forEach(it=>{
    const b=document.createElement("button");
    b.className="f"+(active===it[1]?" on":"");
    b.textContent=it[0];
    b.addEventListener("click",()=>{el.querySelectorAll(".f").forEach(x=>x.classList.remove("on"));b.classList.add("on");onChange(it[1]);});
    el.appendChild(b);
  });
}

function poolFromFilters(){
  const q=rvCfg.q.toLowerCase();
  return EVENTS.filter(e=>{
    if(rvCfg.type!=="全部"&&e.type!==rvCfg.type)return false;
    if(rvCfg.imp!==0&&e.importance!==rvCfg.imp)return false;
    if(rvCfg.per!=="全部"&&e.ch!==rvCfg.per)return false;
    if(q&&!matchEvent(e,q))return false;
    return true;
  });
}

function wrongPool(){
  return EVENTS.filter(e=>localStorage.getItem("ht-review-"+e.title)==="fail");
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
  rvState={queue:pool,fails:[],processed:0,total:pool.length,round:1,okCount:0,failCount:0,mode:rvCfg.mode,roundTotal:pool.length,roundDone:0};
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
  if(ok){s.okCount++;localStorage.setItem("ht-review-"+card.e.title,"ok");}
  else{s.failCount++;s.fails.push(card);localStorage.setItem("ht-review-"+card.e.title,"fail");}
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
