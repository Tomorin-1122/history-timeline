/* quiz.js — 题型专练：判断题/选择题/排序题/多选题（客观题）生成、渲染、判题
   P1（2026-08-12）：判断题；P2：选择题甲种；P3：排序题；P4（2026-08-12）：选择题乙种（跨时段多选） */
'use strict';

/* ---- 时间工具（核心数据转换）---- */

/* 可排序年份：exact/approx 取 year；range 取起点（判题用）；era 返回 null（不可比） */
function quizSortKey(e){
  if(e.year != null) return e.year;
  if(e.yearMode==="range" && Array.isArray(e.yearRange) && e.yearRange.length===2) return e.yearRange[0];
  return null;
}
/* 世纪编号：公元后正数（19 → 19世纪）、公元前负数（-3 → 前3世纪）。无公元 0 年。
   公元后 X世纪 = [100(X-1)+1, 100X]；公元前 X世纪 = [-100X, -100(X-1)-1] */
function centuryOf(y){
  if(y>0) return Math.ceil(y/100);
  return -Math.ceil(-y/100);
}
/* 判断题展示用时间：era 已从池排除；range 显示完整范围（批复：避免"取起点"混淆） */
function quizTimeText(e){
  return fmt(e);   /* fmt 已处理 exact/approx/range（era 返回 null） */
}
/* 题干序列化 hash（错题 key 用）：题干 + 选项文本 */
function quizHash(o){
  return o.q+"|"+o.options.map(x=>x.text).join("|");
}

/* ---- 时间桶（选择题甲种核心）---- */
const QZ_STAGES=["早期","中期","晚期"];
function decadeText(c,dec){ return c+"世纪"+dec+"年代"; }
function centuryText(c,st){ return (c<0?"前":"")+Math.abs(c)+"世纪"+st; }
/* 事件 → 时间桶。y>=1800 用年代（近现代），否则用世纪+早/中/晚（批复三档 0-39/40-69/70-99）。
   range 取起点判题；era/不可比返回 null（原始社会 era 排除，批复） */
function timeBucket(e){
  const y=quizSortKey(e);
  if(y==null) return null;
  if(y>0 && y>=1800){
    const c=Math.ceil(y/100), dec=Math.floor((y%100)/10)*10;
    return {kind:"d", text:decadeText(c,dec), key:"d"+c+"-"+dec};
  }
  const c=centuryOf(y);
  const rem=Math.abs(y)%100||100;   /* 100 年（整世纪）→ 晚期 */
  const st=rem<40?"早期":(rem<70?"中期":"晚期");
  return {kind:"s", text:centuryText(c,st), key:"s"+c+st};
}
/* 混淆项：3 个"相近但确定错误"的时间桶（同世纪±期 + 相邻世纪同期），Set 去重保证选项唯一 */
function choiceADistractors(b){
  const cand=new Set();
  if(b.kind==="d"){
    const m=/^d(\d+)-(\d+)$/.exec(b.key), c=+m[1], dec=+m[2];
    for(const dc of [dec-10,dec+10]) cand.add(decadeText(c,dc));
    for(const cc of [c-1,c+1]) cand.add(decadeText(cc,dec));
    for(const cc of [c-1,c+1]) for(const dc of [dec-10,dec+10]) cand.add(decadeText(cc,dc));
  }else{
    const m=/^s(-?\d+)(.+)$/.exec(b.key), c=+m[1], st=m[2];
    for(const s2 of QZ_STAGES) if(s2!==st) cand.add(centuryText(c,s2));
    for(const cc of [c-1,c+1]) cand.add(centuryText(cc,st));
    for(const cc of [c-1,c+1]) for(const s2 of QZ_STAGES) if(s2!==st) cand.add(centuryText(cc,s2));
  }
  cand.delete(b.text);
  const arr=[...cand];
  shuffle(arr);
  return arr.slice(0,3).length===3 ? arr.slice(0,3) : null;
}
/* 选择题甲种：事件 → 选其所属时间段（4 选项，正确项随机位） */
function genChoiceA(pool,n){
  const eligible=pool.filter(e=>timeBucket(e)!=null);
  const out=[];
  let guard=0;
  while(out.length<n && guard++<600){
    const e=eligible[Math.floor(Math.random()*eligible.length)];
    const b=timeBucket(e);
    const dists=choiceADistractors(b);
    if(!dists) continue;
    const texts=[b.text,...dists];
    shuffle(texts);
    const o={type:"choiceA", q:"「"+e.title+"」发生在哪个时间段？",
             options:texts.map((t,i)=>({label:"ABCD"[i], text:t})),
             answer:texts.indexOf(b.text),
             detail:quizTimeText(e)};   /* 完整时间范围（range 事件避免"取起点"混淆，批复） */
    o.hash=quizHash(o);
    out.push(o);
  }
  return out;
}

/* 排序题（P3）：核心链打乱，判题按链顺序（人工维护，数据同年无 month 亦可靠） */
function findEvent(t){
  return EVENTS.find(e=>e.title===t)||EVENTS_MODERN.find(e=>e.title===t)||EVENTS_WORLD.find(e=>e.title===t)||null;
}
function genSorting(n){
  const chains=Object.values(QUIZ_CHAINS||{}).filter(c=>Array.isArray(c)&&c.length>=3);
  const out=[];
  let guard=0;
  while(out.length<n && chains.length && guard++<100){
    const ch=chains[Math.floor(Math.random()*chains.length)];
    /* 链内事件必须都能在主库找到（防维护后数据改名） */
    if(!ch.every(t=>findEvent(t))) continue;
    const items=ch.map((t,i)=>{ const ev=findEvent(t); return {text:t, time:ev?quizTimeText(ev):""}; });
    const idx=items.map((_,i)=>i);
    shuffle(idx);
    const o={type:"sort", q:"按时间先后排列以下事件",
             items:idx.map(k=>items[k]),
             order:ch.slice(),          /* 正确答案 = 链序（title 数组） */
             hash:"sort|"+ch.join("|")};
    out.push(o);
  }
  return out;
}

/* ---- 选择题乙种（P4）：给定时间段选该时段发生的中外事件（跨史段同池） ---- */
function genChoiceB(n){
  const all=[...EVENTS,...EVENTS_MODERN,...EVENTS_WORLD];
  const bucketMap={};
  for(const e of all){
    const b=timeBucket(e);
    if(b) (bucketMap[b.key]=bucketMap[b.key]||[]).push({e,b});
  }
  const keys=Object.keys(bucketMap);
  const out=[];
  let guard=0;
  while(out.length<n && keys.length && guard++<200){
    const key=keys[Math.floor(Math.random()*keys.length)];
    const group=bucketMap[key];
    if(!group||group.length<3) continue;
    const bText=group[0].b.text;
    shuffle(group);
    const correctCount=Math.min(3, group.length);      /* 正确项 2-3（该时段事件） */
    const correct=group.slice(0,correctCount).map(g=>g.e);
    const wrongPool=all.filter(e=>{ const bb=timeBucket(e); return bb && bb.key!==key; });   /* 错误项：其他时段 */
    shuffle(wrongPool);
    const wrongCount=Math.min(4, Math.max(2, 6-correctCount));
    const wrong=wrongPool.slice(0,wrongCount);
    const opts=[...correct.map(e=>e.title), ...wrong.map(e=>e.title)];
    shuffle(opts);
    const o={type:"choiceB", q:"下列哪些事件发生在「"+bText+"」？（多选）",
             options:opts.map((t,i)=>({label:"ABCDEFGH"[i], text:t})),
             answer:correct.map(ev=>opts.indexOf(ev.title)),
             detail:bText,
             hash:"choiceB|"+bText+"|"+opts.join("|")};
    out.push(o);
  }
  return out;
}

/* ---- 判断题生成 ---- */
/* 同世纪配对（批复：保迷惑性）、同年放弃重取；返回 n 道题对象 */
function genJudgment(pool,n){
  const eligible=pool.filter(e=>quizSortKey(e)!=null);
  const out=[];
  let guard=0;
  while(out.length<n && guard++<800){
    const a=eligible[Math.floor(Math.random()*eligible.length)];
    const b=eligible[Math.floor(Math.random()*eligible.length)];
    if(!a||!b||a===b) continue;
    const ka=quizSortKey(a), kb=quizSortKey(b);
    if(centuryOf(ka)!==centuryOf(kb) || ka===kb) continue;
    const earlier=ka<kb?a:b, later=earlier===a?b:a;
    const eText=quizTimeText(earlier), lText=quizTimeText(later);
    let opts=[
      {label:"A", text:earlier.title, time:eText},
      {label:"B", text:later.title,   time:lText}
    ];
    if(Math.random()<0.5) opts=[opts[1],opts[0]];   /* 正确项位置随机 */
    const o={type:"judge", q:"以下哪个事件发生得更早？", options:opts,
             answer:opts[0].time===eText?0:1,
             earlier:eText, later:lText};
    o.hash=quizHash(o);
    out.push(o);
  }
  return out;
}

/* ---- 渲染（由 review.js 的 showCard 在 quiz 模式下调用）---- */
function renderQuizCard(cur){
  if(cur.type==="sort"){ renderSortCard(cur); return; }
  if(cur.type==="choiceB"){ renderChoiceB(cur); return; }
  const box=document.getElementById("rvQuiz");
  box.innerHTML="";
  const q=document.createElement("div");
  q.className="qz-q"; q.textContent=cur.q;
  const opts=document.createElement("div");
  opts.className="qz-opts";
  cur.options.forEach((o,i)=>{
    const b=document.createElement("button");
    b.className="rv-btn qz-opt"; b.textContent=o.label+"　"+o.text;
    b.addEventListener("click",()=>quizAnswer(i));
    opts.appendChild(b);
  });
  box.appendChild(q); box.appendChild(opts);
  box.hidden=false;
}
/* 多选题渲染：选项 toggle 勾选（■=已选）→「提交」判题 */
function renderChoiceB(cur){
  const s=rvState;
  s.cur._picks=[];
  const box=document.getElementById("rvQuiz");
  box.innerHTML="";
  const q=document.createElement("div");
  q.className="qz-q"; q.textContent=cur.q;
  box.appendChild(q);
  const wrap=document.createElement("div");
  wrap.className="qz-opts";
  cur.options.forEach((o,i)=>{
    const b=document.createElement("button");
    b.className="rv-btn qz-opt"; b.textContent="□　"+o.text;
    b.addEventListener("click",()=>{
      if(b.classList.contains("done")) return;
      const picks=s.cur._picks, k=picks.indexOf(i);
      if(k>=0){ picks.splice(k,1); b.classList.remove("sel"); b.textContent="□　"+o.text; }
      else{ picks.push(i); b.classList.add("sel"); b.textContent="■　"+o.text; }
    });
    wrap.appendChild(b);
  });
  box.appendChild(wrap);
  const sub=document.createElement("button");
  sub.className="rv-btn ok qz-submit"; sub.textContent="提交";
  sub.addEventListener("click",submitChoiceB);
  box.appendChild(sub);
  box.hidden=false;
}
/* 排序题渲染：点选填序号，填满自动判题；点已选事件可取消 */
function renderSortCard(cur){
  const s=rvState;
  s.cur._picks=[];
  const box=document.getElementById("rvQuiz");
  box.innerHTML="";
  const q=document.createElement("div");
  q.className="qz-q"; q.textContent=cur.q;
  box.appendChild(q);
  const wrap=document.createElement("div");
  wrap.className="qz-opts";
  cur.items.forEach((it,i)=>{
    const b=document.createElement("button");
    b.className="rv-btn qz-opt qz-sort-item"; b.textContent=(i+1)+"　"+it.text;
    b.addEventListener("click",()=>{
      const picks=s.cur._picks, t=cur.items[i].text;
      const k=picks.indexOf(t);
      if(k>=0){ picks.splice(k,1); renumSort(); return; }   /* 取消已选 */
      if(picks.length>=cur.items.length) return;
      picks.push(t); renumSort();
      if(picks.length===cur.items.length) submitSort();      /* 填满自动判题 */
    });
    wrap.appendChild(b);
  });
  box.appendChild(wrap);
  box.hidden=false;
}
/* 序号重排：picked 显示其在选择序列中的序号，未选保持固定编号 */
function renumSort(){
  const s=rvState, cur=s.cur.quiz, picks=s.cur._picks;
  const box=document.getElementById("rvQuiz");
  box.querySelectorAll(".qz-sort-item").forEach((b,i)=>{
    const t=cur.items[i].text, k=picks.indexOf(t);
    if(k>=0){ b.classList.add("picked"); b.textContent=(k+1)+"．"+t; }
    else{ b.classList.remove("picked"); b.textContent=(i+1)+"　"+t; }
  });
}
/* 判题反馈：高亮正确项、显示对错与时间、出"下一题"（不再翻牌） */
function showQuizResult(ok,pick){
  const s=rvState, cur=s.cur.quiz;
  const box=document.getElementById("rvQuiz");
  const correctArr=Array.isArray(cur.answer)?cur.answer:[cur.answer];
  const pickedArr=Array.isArray(pick)?pick:(pick==null?[]:[pick]);
  box.querySelectorAll(".qz-opt").forEach((b,i)=>{
    b.disabled=true;
    if(b.classList.contains("qz-sort-item")){ b.classList.add("done"); return; }   /* 排序题：不在此标记 */
    if(correctArr.includes(i)) b.classList.add("right");
    else if(!ok && pickedArr.includes(i)) b.classList.add("wrong");
  });
  box.querySelectorAll(".qz-submit").forEach(x=>x.remove());   /* 多选题提交按钮：判后移除 */
  const res=document.createElement("div");
  res.className="qz-res "+(ok?"ok":"no");
  if(cur.type==="judge"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　"+cur.earlier+"　早于　"+cur.later;
  }else if(cur.type==="choiceA"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　该事件属于　"+cur.options[cur.answer].text+(cur.detail?("　（"+cur.detail+"）"):"");
  }else if(cur.type==="sort"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　正确顺序：";
    res.textContent+=cur.order.map((t,j)=>{ const ev=findEvent(t); return (j+1)+"．"+t+(ev&&quizTimeText(ev)?"（"+quizTimeText(ev)+"）":""); }).join("　");
  }else if(cur.type==="choiceB"){
    res.textContent=(ok?"✓ 全对":"✗ 未全对")+"　发生在「"+cur.detail+"」的事件：";
    res.textContent+=correctArr.map(i=>cur.options[i].text).join("、");
  }
  box.appendChild(res);
  const nx=document.createElement("button");
  nx.className="rv-btn ok qz-next"; nx.textContent="下一题";
  nx.addEventListener("click",quizNext);
  box.appendChild(nx);
}
