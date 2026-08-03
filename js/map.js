/* map.js — 地图视图：Leaflet + 免 key 瓦片、门类五色、双时间轴滑块/自动播放
   双时间轴（老板定案 2026-08-02）：
     hist — 主时间轴 -2070（夏朝）~ 1840（鸦片战争），年单位，线性刻度
     pre  — 原始社会单独时间轴，距今约800万年前 ~ 前2070，**对数（非等距）刻度**：
            滑块值 = MAX_LOG - log10(距今绝对年)，晚近区间（事件密集）在滑块上占比更大 */
'use strict';

let mapObj=null, markers=null, plainMarkers=null, mapInited=false;

/* ---- 时间轴常量 ---- */
const HIST_YMIN=-2070, HIST_YMAX=1840;      /* 主时间轴：夏朝始 ~ 鸦片战争 */
const PRE_MAX_LOG=Math.log10(8000000);       /* 距今约800万年前（对数上界） */
const PRE_MIN_LOG=Math.log10(2070);          /* 前2070（对数下界） */
const PRE_SPAN=PRE_MAX_LOG-PRE_MIN_LOG;      /* 对数跨度 ≈3.59 */
const STEP_HIST=5, STEP_PRE=0.05;            /* 播放步长：历史 5 年 / 史前 0.05 对数单位 */
const R_HIST=50, R_PRE=0.08;                 /* 过滤窗口：历史 50 年 / 史前 ±0.08 数量级(≈±20%年份差) */
const SPEEDS=[1,2,4,8,0.5,0.1];                     /* 播放倍速档（1×→2×→4×→8×→0.5×→0.1× 循环） */

let mapRange='hist';                          /* 'hist' | 'pre' */
let speedIdx=0;                               /* 当前倍速档索引 */
let keepN=10;                                 /* 连续播放时屏幕保留事件数（默认 10） */
const KEEP_OPTS=[10,5,3,2,1];                /* 保留数循环档（默认 10 → 5 → 3 → 2 → 1） */

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
/* 过滤窗口：pre 始终原样（老板定案）；hist 步进后精准 ±0.5，拖动 ±50 */
function curR(){ return mapRange==='pre'?R_PRE:(precise?0.5:R_HIST); }

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
  setStep();
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
  markers=L.markerClusterGroup({
    maxClusterRadius:35,               /* 仅重灾组（≥10 条）进入：低 zoom 成簇 */
    showCoverageOnHover:false,
    spiderfyOnMaxZoom:true,            /* 最大 zoom 仍重合则蜘蛛展开 */
    disableClusteringAtZoom:14,        /* zoom≥14 不再聚合，靠 jitter 精确散开 */
    iconCreateFunction:function(cluster){   /* 簇色=簇内占比最高的门类色（与地点标记匹配） */
      const count={};
      cluster.getAllChildMarkers().forEach(m=>{
        const t=m.options.clType||'政治';
        count[t]=(count[t]||0)+1;
      });
      const top=Object.entries(count).sort((a,b)=>b[1]-a[1])[0][0];
      const color=TYPE_COLORS[top]||"#8a6d2c";
      const n=cluster.getChildCount();
      return L.divIcon({
        html:'<div style="background-color:'+color+';width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:'+(n>=100?12:14)+'px;color:#fff;border:2px solid rgba(255,255,255,.65);box-shadow:0 1px 4px rgba(0,0,0,.35)">'+n+'</div>',
        className:'marker-cluster',
        iconSize:L.point(38,38)
      });
    }
  }).addTo(mapObj);
  plainMarkers=L.layerGroup().addTo(mapObj);   /* 少量重合/独立事件：jitter 散开，不聚类 */
  drawMarkers();
}

/* 门类配色（古籍五色：军事墨蓝、经济竹青、文化靛蓝、制度赭金、政治朱砂） */
const TYPE_COLORS={"政治":"#9e3d26","军事":"#37474f","经济":"#4f6d3a","文化":"#3d5a80","制度":"#8a6d2c","民族关系":"#6d5a8e","对外关系":"#b4713b"};

/* ---- 共享坐标 jitter：完全重合的 marker 确定性散开 ±550m，避免互相压盖点不开 ----
   只对"同一坐标 ≥2 条事件"的 title 偏移；同一 title 每次渲染偏移固定（哈希），刷新不跳位 */
const COORD_KEYS={};
Object.keys(COORDS).forEach(t=>{
  const c=COORDS[t];
  if(!Array.isArray(c)||c.length!==2) return;
  const k=c[0].toFixed(4)+","+c[1].toFixed(4);
  (COORD_KEYS[k]=COORD_KEYS[k]||[]).push(t);
});
const JITTER_SET=new Set();
Object.values(COORD_KEYS).forEach(v=>{ if(v.length>1) v.forEach(t=>JITTER_SET.add(t)); });
/* 重灾坐标组（≥10 条重合，如长安/北京/南京）才进聚类；少量重合靠 jitter 散开 */
const HEAVY_SET=new Set();
Object.values(COORD_KEYS).forEach(v=>{ if(v.length>=10) v.forEach(t=>HEAVY_SET.add(t)); });
function hashStr(s){ let h=7; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h/4294967295; }
function jitterCoord(t,lat,lng){
  if(!JITTER_SET.has(t)) return [lat,lng];
  const h=hashStr(t);
  const dLat=(h*2-1)*0.0049;                       /* ±550m（纬度） */
  const dLng=(((h*97)%1)*2-1)*0.0049/Math.max(Math.cos(lat*Math.PI/180),0.2);  /* 经度按纬度缩放 */
  return [lat+dLat,lng+dLng];
}

/* 渲染单个 marker（alpha 透明度：keepN 播放时旧的渐透明；bold：最新事件标签加粗） */
function addMarker(e, alpha, bold){
  const c=COORDS[e.title]; if(!c) return;
  const [jlat,jlng]=jitterCoord(e.title,c[0],c[1]);  /* 重合坐标确定性散开 ±550m */
  const g=wgs84ToGcj02(jlat,jlng);       /* 高德瓦片需 gcj02，WGS84 源数据转一次 */
  const col=TYPE_COLORS[e.type]||"#9e3d26";
  const isEra=e.yearMode==="era";
  const a=alpha==null?1:alpha;
  const m=L.circleMarker(g,{
    radius:(isEra?9:7)+(bold?3:0), color:col, weight:bold?3:1.5,
    fillColor:isEra?"#f5f1e6":col, fillOpacity:(isEra?.7:.78)*a, opacity:a,
    dashArray:isEra?"3 3":null,
    clType:e.type        /* 供聚类 iconCreateFunction 取门类色 */
  });
  if(yrAll.classList.contains("on")){
    m.bindTooltip(e.title);
  }else{
    const st=[];
    if(a<1) st.push('opacity:'+a);                  /* 标签随事件渐透明 */
    if(bold) st.push('font-weight:700');            /* 最新事件标签加粗 */
    const stl=st.length?' style="'+st.join(';')+'"':'';
    m.bindTooltip('<span'+stl+'>'+e.title+' '+fmtShort(e)+'</span>',{permanent:true,direction:"top",offset:[0,-7],className:"mp-label"});
  }
  m.bindPopup(popupHTML(e),{closeButton:false,offset:[0,-6]});
  /* 重灾组（≥10 条）进聚类；播放/步进/原始社会模式不聚类（事件少，直接显示） */
  (HEAVY_SET.has(e.title) && !playing && !precise && mapRange!=='pre' ? markers : plainMarkers).addLayer(m);
}

function drawMarkers(){
  if(!markers) return;
  markers.clearLayers(); plainMarkers.clearLayers();
  const allMode=yrAll.classList.contains("on"), cyr=+yrSlider.value, R=curR(), q=(state.q||"").toLowerCase();
  const pre=mapRange==='pre';
  /* 连续播放（hist）：保留 ≤当前年 的最近 keepN 个事件，越早越透明，最新置顶（事件到真实年份才出现，不提前） */
  if(!pre && playing && !allMode){
    const keep=[];
    for(const e of EVENTS){
      if(e.ch===0) continue;                      /* 完全隔离：历史模式不看原始社会章 */
      if(state.ch>=0 && e.ch!==state.ch) continue;
      if(!COORDS[e.title]) continue;
      if(state.type!=="全部" && e.type!==state.type) continue;
      if(state.imp!==0 && e.importance!==state.imp) continue;
      if(q && !matchEvent(e,q)) continue;
      if(e.year===null || e.year>cyr) continue;   /* 未来事件不出现 */
      keep.push(e);
    }
    keep.sort((a,b)=>b.year-a.year);
    keep.slice(0,keepN).reverse().forEach((e,idx)=>{   /* 倒序：最旧先加、最新最后加 → 最新层级最高不被遮 */
      addMarker(e,1-((keepN-1-idx)/keepN)*0.85, idx===keepN-1);
    });
    return;
  }
  EVENTS.forEach((e)=>{
    if(pre && e.ch!==0) return;            /* 原始社会模式只看原始社会章 */
    if(!pre && e.ch===0) return;          /* 完全隔离：历史模式不看原始社会章 */
    if(state.ch>=0 && e.ch!==state.ch) return;  /* 分期筛选：只显示所选章 */
    if(!COORDS[e.title]) return;
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
    addMarker(e,1);
  });
}

function popupHTML(e){
  const yr=e.yearMode==="era"?(e.era?(e.era+" · "+e.eraSub):(e.dynasty||e.period||"时代")):fmt(e);
  return '<div class="mp-t">'+e.title+'</div><div class="mp-y">'+yr+' · '+e.type+'</div><div class="mp-s">'+e.summary+'</div>';
}

function fmtYear(v){return v<0?("前 "+(-v)+" 年"):(v+" 年");}

/* ---- 自动播放：连续播放（pre 原样；hist 播放时显示最近 keepN 个事件渐透明，事件到点出现不提前） ---- */
let playing=false, playTimer=null;
let precise=false;                         /* hist 步进后精准 ±0.5；拖 slider 恢复 ±50 */
function setStep(){ yrSlider.step=mapRange==='pre'?(playing?0.001:0.01):(playing?0.1:1); }
function togglePlay(){
  playing=!playing;
  playBtn.textContent=playing?"⏸ 暂停":"▶ 播放";
  playBtn.classList.toggle("on",playing);
  if(playing){
    yrAll.classList.remove("on");
    precise=false;                          /* 播放走 keepN（hist）/原窗口（pre），不用精准 */
    setStep();
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
    setStep();
  }
}
playBtn.addEventListener("click",togglePlay);
/* ---- 步进：上一个/下一个事件（随当前筛选联动：章/门类/等第/搜索均生效，播放中则先停） ---- */
const stepPrev=document.getElementById("stepPrev"), stepNext=document.getElementById("stepNext");
function stepEvent(dir){
  if(playing) togglePlay();
  precise=true;
  const v=+yrSlider.value, pre=mapRange==='pre', q=(state.q||"").toLowerCase();
  let best=null;
  for(const e of EVENTS){
    if(pre && e.ch!==0) continue;
    if(!pre && e.ch===0) continue;         /* 完全隔离：历史模式步进不看原始社会章 */
    if(state.ch>=0 && e.ch!==state.ch) continue;
    if(!COORDS[e.title]) continue;
    if(state.type!=="全部" && e.type!==state.type) continue;
    if(state.imp!==0 && e.importance!==state.imp) continue;
    if(q && !matchEvent(e,q)) continue;
    if(e.year===null) continue;
    const y=pre?logS(Math.abs(e.year)):e.year;
    if(dir>0 && y>v && (best===null||y<best)) best=y;
    if(dir<0 && y<v && (best===null||y>best)) best=y;
  }
  if(best!==null){ yrSlider.value=best; yrLabel.textContent=fmtYrLabel(best); drawMarkers(); }
}
stepPrev.addEventListener("click",()=>stepEvent(-1));
stepNext.addEventListener("click",()=>stepEvent(1));
/* ---- 保留事件数：连续播放时屏幕同时存在 N 个（默认 10），点击循环 10/20/30/50 ---- */
const keepBtn=document.getElementById("keepN");
if(keepBtn){
  keepBtn.textContent="保留 "+keepN+" 个";
  keepBtn.addEventListener("click",()=>{
    keepN=KEEP_OPTS[(KEEP_OPTS.indexOf(keepN)+1)%KEEP_OPTS.length];
    keepBtn.textContent="保留 "+keepN+" 个";
    if(playing) drawMarkers();
  });
}
/* ---- 全屏沉浸式：隐藏顶栏/页脚，仅地图占满（Fullscreen API） ---- */
const fullBtn=document.getElementById("fullBtn");
if(fullBtn){
  fullBtn.addEventListener("click",()=>{
    if(!document.fullscreenElement){
      const p=document.documentElement.requestFullscreen();
      if(p && p.catch) p.catch(()=>{});
      document.body.classList.add("immersive");
    }else{
      const p=document.exitFullscreen();
      if(p && p.catch) p.catch(()=>{});
      document.body.classList.remove("immersive");
    }
  });
  document.addEventListener("fullscreenchange",()=>{
    if(!document.fullscreenElement) document.body.classList.remove("immersive");
  });
}
function pickYearFilter(){precise=false;yrAll.classList.remove("on");yrLabel.textContent=fmtYrLabel(+yrSlider.value);drawMarkers();}
yrSlider.addEventListener("input",()=>{if(playing)togglePlay();pickYearFilter();});
yrAll.addEventListener("click",()=>{yrAll.classList.add("on");yrLabel.textContent="全部年份";drawMarkers();});
