/* quiz.js — 题型专练：判断题/选择题/排序题（客观题）生成、渲染、判题
   P1（2026-08-12）：判断题；P2：选择题甲种；P3（2026-08-12）：排序题（quiz_chains.js 核心链）。乙种规划中（见 docs/进阶题型方案.md） */
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

/* ---- 排序题（P3）：核心链打乱，判题按链顺序（人工维护，数据同年无 month 亦可靠） ---- */
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
  box.querySelectorAll(".qz-opt").forEach((b,i)=>{
    b.disabled=true;
    if(i===cur.answer) b.classList.add("right");
    else if(!ok && i===pick) b.classList.add("wrong");
  });
  const res=document.createElement("div");
  res.className="qz-res "+(ok?"ok":"no");
  if(cur.type==="judge"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　"+cur.earlier+"　早于　"+cur.later;
  }else if(cur.type==="choiceA"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　该事件属于　"+cur.options[cur.answer].text+(cur.detail?("　（"+cur.detail+"）"):"");
  }else if(cur.type==="sort"){
    res.textContent=(ok?"✓ 正确":"✗ 错误")+"　正确顺序：";
    res.textContent+=cur.order.map((t,j)=>{ const ev=findEvent(t); return (j+1)+"．"+t+(ev&&quizTimeText(ev)?"（"+quizTimeText(ev)+"）":""); }).join("　");
  }
  box.appendChild(res);
  const nx=document.createElement("button");
  nx.className="rv-btn ok qz-next"; nx.textContent="下一题";
  nx.addEventListener("click",quizNext);
  box.appendChild(nx);
}
