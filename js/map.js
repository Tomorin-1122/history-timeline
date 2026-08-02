/* map.js — 地图视图：Leaflet + 免 key 瓦片、门类五色、时间滑块/自动播放 */
'use strict';

let mapObj=null, markers=null, mapInited=false;

/* ---- 主时间轴范围：固定 -2070（夏朝始）~ 1840（鸦片战争），老板定案 2026-08-02 ----
   原始社会史前（|year|>=10000）不参与滑块——时间跨度太大挤压历史时期；
   史前事件仅在"全部年份"模式以万年单位/空心圈呈现（数据层 yearMode 复核见 Q1）。 */
const YMIN=-2070, YMAX=1840;

const yrSlider=document.getElementById("yrSlider"),
      yrLabel=document.getElementById("yrLabel"),
      yrAll=document.getElementById("yrAll");
yrSlider.min=YMIN; yrSlider.max=YMAX; yrSlider.value=YMIN;

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
  const allMode=yrAll.classList.contains("on"), cyr=+yrSlider.value, R=50, q=(state.q||"").toLowerCase();
  EVENTS.forEach((e,idx)=>{
    const c=COORDS[e.title]; if(!c) return;
    if(state.type!=="全部" && e.type!==state.type) return;
    if(state.imp!==0 && e.importance!==state.imp) return;
    if(q && !matchEvent(e,q)) return;
    if(!allMode){
      if(e.year===null) return;            /* 播放/过滤时 era 不霸屏 */
      if(Math.abs(e.year-cyr)>R) return;
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
  const yr=e.yearMode==="era"?(e.era?(e.era+" · "+e.eraSub):(e.period||"时代")):fmt(e);
  return '<div class="mp-t">'+e.title+'</div><div class="mp-y">'+yr+' · '+e.type+'</div><div class="mp-s">'+e.summary+'</div>';
}

function fmtYear(v){return v<0?("前 "+(-v)+" 年"):(v+" 年");}

/* ---- 自动播放 ---- */
let playing=false, playTimer=null;
const playBtn=document.getElementById("playBtn");
function togglePlay(){
  playing=!playing;
  playBtn.textContent=playing?"⏸ 暂停":"▶ 播放";
  playBtn.classList.toggle("on",playing);
  if(playing){
    yrAll.classList.remove("on");
    playTimer=setInterval(()=>{
      let v=+yrSlider.value+5;
      if(YMAX!=null && v>YMAX) v=YMIN;
      yrSlider.value=v;
      yrLabel.textContent=fmtYear(v)+" ±50";
      drawMarkers();
    },600);
  }else{
    clearInterval(playTimer);
  }
}
playBtn.addEventListener("click",togglePlay);
function pickYearFilter(){yrAll.classList.remove("on");yrLabel.textContent=fmtYear(+yrSlider.value)+" ±50";drawMarkers();}
yrSlider.addEventListener("input",()=>{if(playing)togglePlay();pickYearFilter();});
yrAll.addEventListener("click",()=>{yrAll.classList.add("on");yrLabel.textContent="全部年份";drawMarkers();});
