/* app.js — 顶框/视图切换/全局绑定（最后加载） */
'use strict';

/* ---- 视图切换：时间轴 / 地图 / 复习 ---- */
const viewTabs=document.getElementById("viewTabs");
function switchView(v){
  if(v==="map"){
    /* 地图史段与时间轴联动：近代史史段 → 近代史地图；古代史史段 → 切回 hist（若上次停在近代史地图） */
    const want=curSeg==="modern"?"modern":(mapRange==="modern"?"hist":mapRange);
    if(typeof setRange==="function" && mapRange!==want) setRange(want);
  }
  document.getElementById("view-timeline").hidden=v!=="timeline";
  document.getElementById("view-map").hidden=v!=="map";
  document.getElementById("view-review").hidden=v!=="review";
  viewTabs.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x.dataset.view===v));
  if(v==="map"){ try{ initMap(); }catch(e){ /* CDN 不可用时（回归测试 abort leaflet）静默，视图切换不受阻 */ } }
  if(v==="review") initReview();
  /* 视图切换 = 筛选上下文切换（时间轴 ↔ 地图各自记忆），恢复该视图的筛选 UI（多选高亮/搜索词/章） */
  if(typeof syncFilterUI==="function") syncFilterUI();
  if(typeof trackBand==="function") trackBand();
  window.scrollTo({top:0,behavior:"auto"}); /* 切换视图回到顶部，避免内容落在视口外 */
}
viewTabs.querySelectorAll(".tab").forEach(tb=>{
  tb.addEventListener("click",()=>switchView(tb.dataset.view));
});

/* ---- 分期链接：时间轴视图跳锚点；地图视图按章过滤 + 切换时间轴模式（事件委托，史段切换重建链接后仍有效） ---- */
document.getElementById("perGroup").addEventListener("click",(ev)=>{
  const a=ev.target.closest("a.jump");
  if(!a) return;
  const onMap=!document.getElementById("view-map").hidden;
  if(onMap){
    ev.preventDefault();               /* 地图界面：不跳回时间轴，按章过滤事件（多选 toggle；「全部」= 清空） */
    const ch=parseInt(a.dataset.ch,10);
    /* 地图模式跟随：点「原始社会」（古代史）自动进 pre；pre 模式点非原始社会章回 hist——先切模式（切换筛选上下文），再在新上下文操作 ch Set */
    const had = ch>=0 && st().ch.has(ch);
    let target = typeof mapRange !== 'undefined' ? mapRange : 'hist';
    if(!had && ch===0 && curSeg!=="modern" && target!=="pre") target="pre";
    else if(!had && ch>0 && target==="pre") target="hist";
    if(target!==mapRange && typeof setRange==="function") setRange(target);
    const s=st().ch;
    if(ch<0) s.clear();                 /* 「全部」= 清空（data-ch=-1） */
    else if(s.has(ch)) s.delete(ch); else s.add(ch);
    if(typeof syncPerLinks==="function") syncPerLinks();
    if(typeof drawMarkers==="function") drawMarkers();
    return;
  }
  switchView("timeline");             /* 时间轴界面：不 preventDefault，浏览器默认按 href 跳锚点（scroll-margin-top 适配顶栏） */
});

/* ---- 史段切换（L2，交接文档 §10.6.3）---- */
const segRow=document.getElementById("segRow");
function switchSeg(seg){
  if(!seg || seg===curSeg) return;
  /* 复习进行中 → 确认后终止本轮回设置 */
  if(typeof rvState!=="undefined" && rvState && !confirm("复习进行中，切换史段将终止本轮并回到设置界面。")) return;
  curSeg=seg;
  segRow.querySelectorAll(".seg-btn").forEach(b=>b.classList.toggle("on",b.dataset.seg===seg));
  /* 底色随史段（ancient 为默认 :root，无需类） */
  document.body.classList.remove("seg-modern","seg-world-ancient","seg-world-modern");
  if(seg!=="ancient") document.body.classList.add("seg-"+seg);
  if(typeof rvState!=="undefined" && rvState && typeof showSetup==="function") showSetup();
  /* 筛选状态：上下文切换（tl-ancient ↔ tl-modern），恢复各自记忆（多选隔离，不再重置默认）
     注意顺序：先重建 row（renderTimeline），再切视图触发 syncFilterUI——否则 applyFilter 用新 curSeg 遍历旧 row 会越界 */
  renderPerLinks(); renderTimeline();
  switchView("timeline");
  if(typeof syncFilterUI==="function") syncFilterUI();
}
segRow.querySelectorAll(".seg-btn").forEach(b=>{
  b.addEventListener("click",()=>switchSeg(b.dataset.seg));
});

/* ---- 抽屉：点击背景关闭 ---- */
document.getElementById("overlay").addEventListener("click",closeDrawer);
