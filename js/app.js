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

/* ---- 分期链接：若在地图/复习视图，先切回时间轴再跳锚点 ---- */
document.querySelectorAll(".bar a.jump").forEach(a=>{
  a.addEventListener("click",()=>switchView("timeline"));
});

/* ---- 抽屉：点击背景关闭 ---- */
document.getElementById("overlay").addEventListener("click",closeDrawer);
