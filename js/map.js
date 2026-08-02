/* map.js — 地图视图：Leaflet + 免 key 瓦片、门类五色、双时间轴滑块/自动播放
   双时间轴（老板定案 2026-08-02）：
     hist — 主时间轴 -2070（夏朝）~ 1840（鸦片战争），年单位，线性刻度
     pre  — 原始社会单独时间轴，距今约800万年前 ~ 前2070，**对数（非等距）刻度**：
            滑块值 = MAX_LOG - log10(距今绝对年)，晚近区间（事件密集）在滑块上占比更大 */
'use strict';

let mapObj=null, markers=null, mapInited=false;

/* ---- 时间轴常量 ---- */
const HIST_YMIN=-2070, HIST_YMAX=1840;      /* 主时间轴：夏朝始 ~ 鸦片战争 */
const PRE_MAX_LOG=Math.log10(8000000);       /* 距今约800万年前（对数上界） */
const PRE_MIN_LOG=Math.log10(2070);          /* 前2070（对数下界） */
const PRE_SPAN=PRE_MAX_LOG-PRE_MIN_LOG;      /* 对数跨度 ≈3.59 */
const STEP_HIST=5, STEP_PRE=0.05;            /* 播放步长：历史 5 年 / 史前 0.05 对数单位 */
const R_HIST=50, R_PRE=0.08;                 /* 过滤窗口：历史 50 年 / 史前 ±0.08 数量级(≈±20%年份差) */
const SPEEDS=[1,2,4,8];                      /* 播放倍速档 */

let mapRange='hist';                          /* 'hist' | 'pre' */
let speedIdx=0;                               /* 当前倍速档索引 */

const yrSlider=document.getElementById("yrSlider"),
      yrLabel=document.getElementById("yrLabel"),
      yrAll=document.getElementById("yrAll"),
      playBtn=document.getElementById("playBtn"),
      speedBtn=document.getElementById("speedBtn");
yrSlider.min=HIST_YMIN; yrSlider.max=HIST_YMAX; yrSlider.value=HIST_YMIN;

/* 史前绝对年 → 滑块对数值：s = MAX_LOG - log10(absYear)（0=距今最远，PRE_SPAN=距今最近） */
function logS(absYear){ return PRE_MAX_LOG - Math.log10(Math.max(absYear,1)); }

function curY(){ return mapRange==='pre'?[0,PRE_SPAN]:[HIST_YMIN,HIST_YMAX]; }
function curStep(){ return (mapRange==='pre'?STEP_PRE:STEP_HIST)*SPEEDS[speedIdx]; }
function curR(){ return mapRange==='pre'?R_PRE:R_HIST; }

/* 年份标签：历史"前 X 年 ±50"；史前"距今约 X 万年 前后"（对数刻度逆变换） */
function fmtYrLabel(v){
  if(mapRange==='pre'){
    const absY=Math.round(Math.pow(10, PRE_MAX_LOG - v));
    return "距今约 "+fmtWan(absY)+" 前后";
  }
  return fmtYear(v)+" ±50";
}

/* 切换时间轴模式（原始社会 / 历史时期） */
function setRange(mode){
  if(mode===mapRange) return;
  mapRange=mode;
  document.querySelectorAll(".range-btn").forEach(b=>b.classList.toggle("on",b.dataset.range===mode));
  const [ymin,ymax]=curY();
  yrSlider.min=ymin; yrSlider.max=ymax; yrSlider.value=ymin;
  if(playing) togglePlay();               /* 切模式停播放，避免范围/步长混乱 */
  yrLabel.textContent=yrAll.classList.contains("on")?"全部年份":fmtYrLabel(+yrSlider.value);
  drawMarkers();
}
document.querySelectorAll(".range-btn").forEach(b=>{
  b.addEventListener("click",()=>setRange(b.dataset.range));
});

/* 播放倍速：1×→2×→4×→8× 循环 */
speedBtn.addEventListener("click",()=>{
  speedIdx=(speedIdx+1)%SPEEDS.length;
  speedBtn.textContent=SPEEDS[speedIdx]+"×";
});

/* ---- 初始化：免 key 高德公开端点（08-02 方向：不申请商业 key；天地图 tk 到位可切换） ---- */
function initMap(){
  if(mapInited) return; mapInited=true;
  mapObj=L.map("map",{zoomControl:true}).setView([34,110],5);
  L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    {subdomains:["1","2","3","4"],maxZoom:18,opacity:.78,attribution:"高德地图"}).addTo(mapObj);
  markers=L.layerGroup().addTo(mapObj);
  drawMarkers();
}

/* 门类配色（古籍五色：军事墨蓝、经济竹青、文化靛蓝、制度赭金、政治朱砂） */
const TYPE_COLORS={"政治":"#9e3d26","军事":"#37474f","经济":"#4f6d3a","文化":"#3d5a80","制度":"#8a6d2c"};

function drawMarkers(){
  if(!markers) return;
  markers.clearLayers();
  const allMode=yrAll.classList.contains("on"), cyr=+yrSlider.value, R=curR(), q=(state.q||"").toLowerCase();
  const pre=mapRange==='pre';
  EVENTS.forEach((e,idx)=>{
    if(pre && e.ch!==0) return;            /* 原始社会模式只看原始社会章 */
    const c=COORDS[e.title]; if(!c) return;
    if(state.type!=="全部" && e.type!==state.type) return;
    if(state.imp!==0 && e.importance!==state.imp) return;
    if(q && !matchEvent(e,q)) return;
    if(!allMode){
      if(e.year===null) return;            /* 播放/过滤时 era 不霸屏 */
      if(pre){
        if(Math.abs(logS(Math.abs(e.year))-cyr)>R) return;  /* 对数空间过滤 */
      }else{
        if(Math.abs(e.year-cyr)>R) return;
      }
    }
    const g=wgs84ToGcj02(c[0],c[1]);       /* 高德瓦片需 gcj02，WGS84 源数据转一次 */
    const col=TYPE_COLORS[e.type]||"#9e3d26";
    const isEra=e.yearMode==="era";
    const m=L.circleMarker(g,{
      radius:isEra?9:7, color:col, weight:1.5,
      fillColor:isEra?"#f5f1e6":col, fillOpacity:isEra?.7:.78,
      dashArray:isEra?"3 3":null
    });
    if(allMode){
      m.bindTooltip(e.title);
    }else{
      m.bindTooltip(e.title+" "+fmtShort(e),{permanent:true,direction:"top",offset:[0,-7],className:"mp-label"});
    }
    m.bindPopup(popupHTML(e),{closeButton:false,offset:[0,-6]});
    markers.addLayer(m);
  });
}

function popupHTML(e){
  const yr=e.yearMode==="era"?(e.era?(e.era+" · "+e.eraSub):(e.dynasty||e.period||"时代")):fmt(e);
  return '<div class="mp-t">'+e.title+'</div><div class="mp-y">'+yr+' · '+e.type+'</div><div class="mp-s">'+e.summary+'</div>';
}

function fmtYear(v){return v<0?("前 "+(-v)+" 年"):(v+" 年");}

/* ---- 自动播放 ---- */
let playing=false, playTimer=null;
function togglePlay(){
  playing=!playing;
  playBtn.textContent=playing?"⏸ 暂停":"▶ 播放";
  playBtn.classList.toggle("on",playing);
  if(playing){
    yrAll.classList.remove("on");
    playTimer=setInterval(()=>{
      let v=+yrSlider.value+curStep();
      const [ymin,ymax]=curY();
      if(v>ymax) v=ymin;
      yrSlider.value=v;
      yrLabel.textContent=fmtYrLabel(v);
      drawMarkers();
    },600);
  }else{
    clearInterval(playTimer);
  }
}
playBtn.addEventListener("click",togglePlay);
function pickYearFilter(){yrAll.classList.remove("on");yrLabel.textContent=fmtYrLabel(+yrSlider.value);drawMarkers();}
yrSlider.addEventListener("input",()=>{if(playing)togglePlay();pickYearFilter();});
yrAll.addEventListener("click",()=>{yrAll.classList.add("on");yrLabel.textContent="全部年份";drawMarkers();});
