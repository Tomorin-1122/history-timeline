/* quiz.js — 题型专练：判断题/选择题/排序题（客观题）生成、渲染、判题
   P1（2026-08-12）：判断题。选择题甲种/乙种、排序题规划中（见 docs/进阶题型方案.md） */
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
  res.textContent=(ok?"✓ 正确":"✗ 错误")+"　"+cur.earlier+"　早于　"+cur.later;
  box.appendChild(res);
  const nx=document.createElement("button");
  nx.className="rv-btn ok qz-next"; nx.textContent="下一题";
  nx.addEventListener("click",quizNext);
  box.appendChild(nx);
}
