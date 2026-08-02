/* app.js — 顶框/视图切换/全局绑定（最后加载） */
'use strict';

/* ---- 视图切换：时间轴 / 地图 / 复习 ---- */
const viewTabs=document.getElementById("viewTabs");
function switchView(v){
  document.getElementById("view-timeline").hidden=v!=="timeline";
  document.getElementById("view-map").hidden=v!=="map";
  document.getElementById("view-review").hidden=v!=="review";
  viewTabs.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x.dataset.view===v));
  if(v==="map") initMap();
  if(v==="review") initReview();
  if(typeof trackBand==="function") trackBand();
  window.scrollTo({top:0,behavior:"auto"}); /* 切换视图回到顶部，避免内容落在视口外 */
}
viewTabs.querySelectorAll(".tab").forEach(tb=>{
  tb.addEventListener("click",()=>switchView(tb.dataset.view));
});

/* ---- 分期链接：时间轴视图跳锚点；地图视图不跳转，切换时间轴模式（原始社会→史前） ---- */
document.querySelectorAll(".bar a.jump").forEach(a=>{
  a.addEventListener("click",(ev)=>{
    const onMap=!document.getElementById("view-map").hidden;
    if(onMap){
      ev.preventDefault();               /* 地图界面：不再跳回时间轴 */
      if(typeof setRange==="function") setRange(a.textContent==="原始社会"?"pre":"hist");
      return;
    }
    switchView("timeline");             /* 时间轴界面：维持原跳锚点行为 */
  });
});

/* ---- 抽屉：点击背景关闭 ---- */
document.getElementById("overlay").addEventListener("click",closeDrawer);
