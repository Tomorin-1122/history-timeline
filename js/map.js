/* map.js — 地图视图：Leaflet + 免 key 瓦片、门类五色、三时间轴滑块/自动播放
   三时间轴（2026-08-04 三态下拉）：
     hist — 古代史主时间轴 -2070（夏朝）~ 1840（鸦片战争），年单位，线性刻度
     pre  — 原始社会单独时间轴，距今约800万年前 ~ 前2070，**对数（非等距）刻度**：
            滑块值 = MAX_LOG - log10(距今绝对年)，晚近区间（事件密集）在滑块上占比更大
     modern — 中国近现代史 1838（黄爵滋上书）~ 2012，**年份为基本刻度**（step=1），播放步长更细腻（0.5年/tick 可倍速） */
'use strict';

let mapObj=null, markers=null, plainMarkers=null, mapInited=false;

/* ---- 时间轴常量 ---- */
const HIST_YMIN=-2070, HIST_YMAX=1840;      /* 主时间轴：夏朝始 ~ 鸦片战争 */
const MODERN_YMIN=1838, MODERN_YMAX=2012;   /* 近代史：黄爵滋上书(1838) ~ 2012，年份刻度 */
const WORLD_ANCIENT_YMIN=-8000, WORLD_ANCIENT_YMAX=1500;  /* 世界古代中世纪史：史前~中古封建时代（标准边界 1500 止，2026-08-05） */
const WORLD_MODERN_YMIN=1492, WORLD_MODERN_YMAX=2012;     /* 世界近现代史：近代早期~当代（1492 起——地理大发现哥伦布移入后最早年份，老板定案） */
const PRE_MAX_LOG=Math.log10(8000000);       /* 距今约800万年前（对数上界） */
const PRE_MIN_LOG=Math.log10(2070);          /* 前2070（对数下界） */
const PRE_SPAN=PRE_MAX_LOG-PRE_MIN_LOG;      /* 对数跨度 ≈3.59 */
const STEP_HIST=5, STEP_PRE=0.05, STEP_MODERN=0.5;  /* 播放步长：历史 5 年 / 史前 0.05 对数单位 / 近代史 0.5 年（细腻） */
const STEP_WORLD_ANCIENT=25, STEP_WORLD_MODERN=1;     /* 播放步长：世界古代 25 年 / 世界近现代 1 年 */
const R_HIST=50, R_PRE=0.08, R_MODERN=2;     /* 过滤窗口：历史 50 年 / 史前 ±0.08 数量级 / 近代史 ±2 年 */
const R_WORLD_ANCIENT=50, R_WORLD_MODERN=2;  /* 过滤窗口：世界古代 ±50 年 / 世界近现代 ±2 年 */
const SPEEDS=[1,2,4,8,0.5,0.1];                     /* 播放倍速档（1×→2×→4×→8×→0.5×→0.1× 循环） */

let mapRange='hist';                          /* 'hist' | 'pre' | 'modern' | 'world-ancient' | 'world-modern'（五态下拉，2026-08-05 加世界史两段） */
let speedIdx=0;                               /* 当前倍速档索引 */
let keepN=10;                                 /* 连续播放时屏幕保留事件数（默认 10） */
const KEEP_OPTS=[10,5,3,2,1];                /* 保留数循环档（默认 10 → 5 → 3 → 2 → 1） */

/* ---- 近代史重灾城市 period 分堆（2026-08-05 老板定案：仅北京/上海/南京，zoom≥6 静态模式）
   点击聚簇跳转后，三城事件不再挤成散点，而是按 period（11 时段）分堆，便于快速排查 ---- */
const CITY_CLUSTER={
  '北京':[39.9042,116.4074],
  '上海':[31.2304,121.4737],
  '南京':[32.0603,118.7969],
};
const CITY_R=0.4;                  /* 城市归属半径（度，覆盖城区+近郊如卢沟桥/宝山路） */
const CITY_ZOOM=6;                 /* zoom≥6（城市级别可辨）启用分堆 */
const PERIOD_COLORS=Array.from({length:CHAPTERS_MODERN.length},(_,i)=>`hsl(${(i*33)%360},62%,42%)`);  /* 11 时段色板（色相环等分） */
let cityPeriodFocus=null;          /* {city, period} 点击 period 子簇后聚焦该时段散点（其他时段临时隐藏） */
function inCity(c){
  if(!c) return null;
  for(const city of Object.keys(CITY_CLUSTER)){
    const [lat,lng]=CITY_CLUSTER[city];
    if(Math.abs(c[0]-lat)<CITY_R && Math.abs(c[1]-lng)<CITY_R) return city;
  }
  return null;
}
/* 时段短标：'1840-1864' → '40-64'（子簇 divIcon 用，紧凑） */
function periodShort(note){ return String(note||'').replace(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/,'$2-$4'); }

const yrSlider=document.getElementById("yrSlider"),
      yrLabel=document.getElementById("yrLabel"),
      yrAll=document.getElementById("yrAll"),
      playBtn=document.getElementById("playBtn"),
      speedBtn=document.getElementById("speedBtn");
yrSlider.min=HIST_YMIN; yrSlider.max=HIST_YMAX; yrSlider.value=HIST_YMIN;

/* 史前绝对年 → 滑块对数值：s = MAX_LOG - log10(absYear)（0=距今最远，PRE_SPAN=距今最近） */
function logS(absYear){ return PRE_MAX_LOG - Math.log10(Math.max(absYear,1)); }

/* 当前地图数据源：modern 用近代史数组，world-* 用世界史（4+4 分段 ch 归一化），其余用古代史 */
function segEV(){
  if(mapRange==='world-ancient') return EVENTS_WORLD.filter(e=>e.ch<4);
  if(mapRange==='world-modern')  return EVENTS_WORLD.filter(e=>e.ch>=4).map(e=>({...e,ch:e.ch-4}));
  return mapRange==='modern' ? EVENTS_MODERN : EVENTS;
}
/* 排序键（步进/播放 keepN 用）：modern/world-* 按老板规则(年/月/日，无月排年首、无日排月首)；hist 按 年*13+月；pre 对数刻度单独处理 */
function mapSortKey(e){ return (mapRange==='modern'||mapRange==='world-ancient'||mapRange==='world-modern') ? e.year*13*32+(e.month||0)*32+(e.day||0) : e.year*13+(e.month||13); }

function curY(){ return mapRange==='pre'?[0,PRE_SPAN]:mapRange==='modern'?[MODERN_YMIN,MODERN_YMAX]:mapRange==='world-ancient'?[WORLD_ANCIENT_YMIN,WORLD_ANCIENT_YMAX]:mapRange==='world-modern'?[WORLD_MODERN_YMIN,WORLD_MODERN_YMAX]:[HIST_YMIN,HIST_YMAX]; }
function curStep(){ return (mapRange==='pre'?STEP_PRE:mapRange==='modern'?STEP_MODERN:mapRange==='world-ancient'?STEP_WORLD_ANCIENT:mapRange==='world-modern'?STEP_WORLD_MODERN:STEP_HIST)*SPEEDS[speedIdx]; }
/* 过滤窗口：pre 始终原样（老板定案）；hist 步进后精准 ±0.5，拖动 ±50；modern/world-modern 步进精准 ±0.5，拖动 ±2；world-ancient 步进精准 ±0.5，拖动 ±50 */
function curR(){ return mapRange==='pre'?R_PRE:(precise?0.5:(mapRange==='modern'||mapRange==='world-modern'?R_MODERN:mapRange==='world-ancient'?R_WORLD_ANCIENT:R_HIST)); }

/* 年份标签：历史"前 X 年 ±50"；步进/精准模式显示"前 X 年 · 精准定位"；史前"距今约 X 万年 前后"（对数刻度逆变换）；
   modern"1838 年 ±2"（年份刻度） */
function fmtYrLabel(v){
  if(mapRange==='pre'){
    const absY=Math.round(Math.pow(10, PRE_MAX_LOG - v));
    return "距今约 "+fmtWan(absY)+" 前后";
  }
  if(mapRange==='modern'||mapRange==='world-modern') return precise ? fmtYear(v)+" · 精准定位" : fmtYear(v)+" ±2";
  return precise ? fmtYear(v)+" · 精准定位" : fmtYear(v)+" ±50";
}

/* 切换地图（三态下拉：原始社会/历史时期/中国近现代史） */
const rangeSel=document.getElementById("rangeSel");
/* ---- 清代 1820 省界线层（2026-08-05 试水：hist 模式滑块 1644-1820 显示，全数据 data/borders.js） ---- */
const BORDER_YEARS=[1644,1820];
let borderLayer=null, borderShown=false;
function drawBorder(){
  if(mapRange!=='hist' || yrAll.classList.contains("on")){ hideBorder(); return; }
  const cyr=+yrSlider.value;
  if(!(cyr>=BORDER_YEARS[0] && cyr<=BORDER_YEARS[1])){ hideBorder(); return; }
  if(!borderLayer){
    if(typeof BORDER_QING1820==="undefined") return;
    borderLayer=L.geoJSON(BORDER_QING1820,{
      style:{color:"#b45309",weight:1.2,fillColor:"#f59e0b",fillOpacity:.15},
      onEachFeature:(f,l)=>l.bindTooltip(f.properties.NAME_CH||"",{direction:"top"})
    });
  }
  if(!borderShown){ mapObj.addLayer(borderLayer); borderShown=true; }
}
function hideBorder(){ if(borderLayer && borderShown){ mapObj.removeLayer(borderLayer); borderShown=false; } }

function setRange(mode){
  if(mode===mapRange) return;
  mapRange=mode;
  rangeSel.value=mode;
  cityPeriodFocus=null;            /* 切模式清城市时段聚焦 */
  /* 换地图 = 切换筛选上下文（map-pre/hist/modern 各自记忆 type/imp/q/ch，不再清 ch） */
  const [ymin,ymax]=curY();
  setStep();
  yrSlider.min=ymin; yrSlider.max=ymax; yrSlider.value=ymin;
  if(playing) togglePlay();               /* 切模式停播放，避免范围/步长混乱 */
  yrLabel.textContent=yrAll.classList.contains("on")?"全部年份":fmtYrLabel(+yrSlider.value);
  drawMarkers();
  if(typeof syncFilterUI==="function") syncFilterUI();   /* 恢复该地图上下文的筛选记忆（多选 + 章高亮 + 搜索词） */
}
rangeSel.addEventListener("change",()=>setRange(rangeSel.value));

/* 播放倍速：1×→2×→4×→8× 循环 */
speedBtn.addEventListener("click",()=>{
  speedIdx=(speedIdx+1)%SPEEDS.length;
  speedBtn.textContent=SPEEDS[speedIdx]+"×";
});

/* ---- 底图双轨（2026-08-03 部署版）：天地图优先（矢量/影像/地形可切换），瓦片 403 自动回退高德 ----
   天地图浏览器端 key：Referer 白名单防护（timeline.yinyizhuan.cn, history-timeline-vert.vercel.app）；file:// 无 http Referer 必 403 → 回退高德 */
const TDT_KEY="78aa1282ea7b6cabd336a205aada9e36";
const TDT_SUB=["0","1","2","3","4","5","6","7"];
const TDT_URL=function(layer){return "https://t{s}.tianditu.gov.cn/"+layer+"_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER="+layer+"&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk="+TDT_KEY;};
const GAODE_URL="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
let tileMode="tdt";        /* 'tdt' 天地图（WGS84 免转换） | 'gaode' 高德（需 gcj02） */
let tdtErr=0;              /* 天地图瓦片连续失败计数 */
/* 天地图三底图：矢量（默认）/ 影像（卫星）/ 地形（山川）——底图 + 注记图层名 */
const TDT_BASES=[{base:"vec",ann:"cva",name:"矢量"},{base:"img",ann:"cia",name:"影像"},{base:"ter",ann:"cta",name:"地形"}];
let tdtBaseIdx=0, tdtLayers=[];
const mapCtrlBtns={};      /* 地图内控件按钮引用（底图/全屏），供回退时更新 */

function buildTdtLayers(){
  tdtLayers.forEach(l=>mapObj.removeLayer(l));
  const b=TDT_BASES[tdtBaseIdx];
  const cur=[];                              /* 当前批次图层：切换后旧批次事件忽略，防 abort 误触发回退 */
  const vec=L.tileLayer(TDT_URL(b.base),{subdomains:TDT_SUB,maxZoom:18,opacity:.78});
  const cva=L.tileLayer(TDT_URL(b.ann),{subdomains:TDT_SUB,maxZoom:18,opacity:1});
  vec.on("tileerror",()=>{ if(tdtLayers!==cur) return; onTdtErr(); });
  cva.on("tileerror",()=>{ if(tdtLayers!==cur) return; onTdtErr(); });
  cur.push(vec,cva);
  tdtLayers=cur;
  vec.addTo(mapObj); cva.addTo(mapObj);
}
function onTdtErr(){
  tdtErr++;
  if(tdtErr>=3 && tileMode==="tdt"){   /* 白名单未配 / file://：回退高德，不白屏 */
    tdtLayers.forEach(l=>mapObj.removeLayer(l));
    tileMode="gaode";
    L.tileLayer(GAODE_URL,{subdomains:["1","2","3","4"],maxZoom:18,opacity:.78}).addTo(mapObj);
    if(typeof _setMapAttr==="function") _setMapAttr("高德地图");   /* 底部来源声明同步 */
    if(mapCtrlBtns.base) updateBaseBtn();
    drawMarkers();                       /* 重绘：坐标改走 gcj02 */
  }
}

/* ---- 初始化：天地图优先；403 连续 3 次自动回退高德（本地 file:// 打开不白屏） ---- */
function initMap(){
  if(mapInited) return; mapInited=true;
  mapObj=L.map("map",{zoomControl:true}).setView([34,110],5);   /* attributionControl 默认开启：保留 Leaflet 署名链接（开源协议） */
  /* 来源声明放地图下方空白处（2026-08-05 老板定案：不放地图内）；底图切换/回退时更新 */
  const setAttr=(base)=>{
    const el=document.getElementById("mapAttr");
    if(el) el.innerHTML='底图 © '+base+' ｜ 清代省界 © CHGIS V6（复旦史地所/哈佛，地图书转换）';
  };
  window._setMapAttr=setAttr;
  setAttr(tileMode==="tdt"?"天地图·国家基础地理信息中心":"高德地图");
  if(tileMode==="tdt") buildTdtLayers();
  else L.tileLayer(GAODE_URL,{subdomains:["1","2","3","4"],maxZoom:18,opacity:.78}).addTo(mapObj);
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
  addMapControls();                            /* 地图内控件：底图切换 + 全屏 */
  /* zoom 低于城市级别 → 退回普通聚簇，清城市时段聚焦（近代史分堆） */
  mapObj.on("zoomend",()=>{
    if(cityPeriodFocus && mapObj.getZoom()<CITY_ZOOM){ cityPeriodFocus=null; }
    if(mapRange==='modern' && !playing && !precise) drawMarkers();
  });
  drawMarkers();
}

/* ---- 地图内控件（叠在左上角缩放按钮下，Leaflet 原生控件风格）：底图切换 + 全屏 ---- */
function addMapControls(){
  const ctrl=L.control({position:"topleft"});
  ctrl.onAdd=function(){
    const div=L.DomUtil.create("div","leaflet-bar map-ctrl");
    const base=L.DomUtil.create("a","",div); base.href="#";
    base.textContent=TDT_BASES[tdtBaseIdx].name.charAt(0);   /* 单字图标：矢/影/地（方形按钮不遮挡） */
    base.title="切换底图：矢量/影像/地形（当前："+TDT_BASES[tdtBaseIdx].name+"）";
    const full=L.DomUtil.create("a","",div); full.href="#"; full.title="全屏沉浸式（仅地图）"; full.textContent="⛶";
    mapCtrlBtns.base=base; mapCtrlBtns.full=full;
    L.DomEvent.disableClickPropagation(div).disableScrollPropagation(div);
    L.DomEvent.on(base,"click",e=>{L.DomEvent.preventDefault(e);swapTdtBase();});
    L.DomEvent.on(full,"click",e=>{L.DomEvent.preventDefault(e);toggleFullscreen();});
    return div;
  };
  ctrl.addTo(mapObj);
}
function swapTdtBase(){
  if(tileMode==="gaode"){
    /* 从高德切回天地图（白名单外域名仍会 403 再回退，但不再锁死；按钮可反复尝试） */
    tileMode="tdt"; tdtErr=0;
    mapObj.eachLayer(l=>{ if(l instanceof L.TileLayer) mapObj.removeLayer(l); });
    buildTdtLayers();
    drawMarkers();                          /* 坐标切回 WGS84（免转换） */
    updateBaseBtn();
    return;
  }
  tdtBaseIdx=(tdtBaseIdx+1)%TDT_BASES.length;
  tdtErr=0;
  buildTdtLayers();
  updateBaseBtn();
}
function updateBaseBtn(){
  if(!mapCtrlBtns.base) return;
  if(tileMode==="gaode"){
    mapCtrlBtns.base.textContent="高";
    mapCtrlBtns.base.title="底图已回退高德（天地图不可用）；点击可重试天地图";
  }else{
    mapCtrlBtns.base.textContent=TDT_BASES[tdtBaseIdx].name.charAt(0);
    mapCtrlBtns.base.title="切换底图：矢量/影像/地形（当前："+TDT_BASES[tdtBaseIdx].name+"）";
  }
}
function toggleFullscreen(){
  if(!document.fullscreenElement){
    const p=document.documentElement.requestFullscreen();
    if(p && p.catch) p.catch(()=>{});
    document.body.classList.add("immersive");
  }else{
    const p=document.exitFullscreen();
    if(p && p.catch) p.catch(()=>{});
    document.body.classList.remove("immersive");
  }
}
document.addEventListener("fullscreenchange",()=>{
  if(!document.fullscreenElement) document.body.classList.remove("immersive");
});

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
  /* 底图双轨：天地图 WGS84 直接用（CGCS2000≈WGS84 免转换）；高德瓦片需转 gcj02 */
  const g=tileMode==="tdt"?[jlat,jlng]:wgs84ToGcj02(jlat,jlng);
  const col=TYPE_COLORS[e.type]||"#9e3d26";
  const isEra=e.yearMode==="era";
  const a=alpha==null?1:alpha;
  const m=L.circleMarker(g,{
    radius:(isEra?9:7)+(bold?3:0), color:col, weight:bold?3:1.5,
    fillColor:isEra?"#f5f1e6":col,
    /* 近代史事件密、圆点小，填充 0.78 视觉发虚（老板反馈"过分透明"）→ modern 用 0.92 更实；pre/hist 保持原样 */
    fillOpacity:(isEra?.7:.78)*(mapRange==='modern'?1.18:1)*a,
    opacity:a,
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
  /* 重灾组（≥10 条）进聚类；播放/步进/原始社会模式不聚类（事件少，直接显示）；城市时段聚焦态也强制散开（不聚簇） */
  (HEAVY_SET.has(e.title) && !playing && !precise && mapRange!=='pre' && !cityPeriodFocus ? markers : plainMarkers).addLayer(m);
}

/* 共用筛选谓词：章隔离（pre/hist）+ 分期筛选 + 坐标 + 门类 + 等第 + 搜索（type/imp/ch 多选 Set，空 Set=全部）
   M1 修复：播放 / 普通渲染 / 步进三条路径统一走此谓词，避免重复过滤导致的回归 bug
   modern：近代史数组 ch 0-10 是段索引（无"原始社会章"概念），跳过 ch0 隔离 */
function matchFilter(e, pre, q){
  const f=st();
  const isCN=mapRange==='pre'||mapRange==='hist';   /* 原始社会章隔离仅限中国古代史 pre/hist（modern 无"原始社会章"概念；world ch=0 是史前时代段也不隔离） */
  if(isCN){
    if(pre && e.ch!==0) return false;            /* 原始社会模式只看原始社会章 */
    if(!pre && e.ch===0) return false;          /* 完全隔离：历史模式不看原始社会章 */
  }
  if(f.ch.size && !f.ch.has(e.ch)) return false;
  if(!COORDS[e.title]) return false;
  if(f.type.size && !f.type.has(e.type)) return false;
  if(f.imp.size && !f.imp.has(e.importance)) return false;
  if(q && !matchEvent(e,q)) return false;
  return true;
}

function drawMarkers(){
  if(!markers) return;
  markers.clearLayers(); plainMarkers.clearLayers();
  const EV=segEV();
  const allMode=yrAll.classList.contains("on"), cyr=+yrSlider.value, R=curR(), q=(st().q||"").toLowerCase();
  const pre=mapRange==='pre';
  /* 连续播放（hist/modern）：保留 ≤当前年 的最近 keepN 个事件，越早越透明，最新置顶（事件到真实年份才出现，不提前） */
  if(!pre && playing && !allMode){
    const keep=[];
    for(const e of EV){
      if(!matchFilter(e,false,q)) continue;
      if(e.year===null || e.year>cyr) continue;   /* 未来事件不出现 */
      keep.push(e);
    }
    keep.sort((a,b)=> mapSortKey(b)-mapSortKey(a));   /* 复合时间降序：晚月/晚日事件最后添加置顶 */
    keep.slice(0,keepN).reverse().forEach((e,idx)=>{   /* 倒序：最旧先加、最新最后加 → 最新层级最高不被遮 */
      addMarker(e,1-((keepN-1-idx)/keepN)*0.85, idx===keepN-1);
    });
    drawBorder();
    return;
  }
  /* 近代史静态 + 城市级别 zoom：北京/上海/南京按 period 分堆（老板定案 2026-08-05），其余照常 */
  if(mapRange==='modern' && mapObj.getZoom()>=CITY_ZOOM){
    drawWithCityClusters(EV, cyr, R, allMode);
    drawBorder();
    return;
  }
  EV.forEach((e)=>{
    if(!matchFilter(e,pre,q)) return;
    if(!allMode){
      if(e.year===null) return;            /* 播放/过滤时 era 不霸屏 */
      if(pre){
        if(Math.abs(logS(Math.abs(e.year))-cyr)>R) return;  /* 对数空间过滤 */
      }else{
        if(Math.abs(e.year-cyr)>R) return;
      }
    }
    addMarker(e,1, focusKey && e.title===focusKey);   /* 步进聚焦事件加粗（同年月序步进时滑块不动、聚焦切换） */
  });
  drawBorder();   /* 清代省界线：hist + 滑块 1644-1820 + 非全部年份时显示（2026-08-05 试水） */
}

/* ---- 近代史重灾城市 period 分堆绘制（2026-08-05）
   北京/上海/南京：静态模式 zoom≥6 时，事件按 period 分组为子簇（divIcon 时段短标+数量）；
   点击子簇 → zoom 到城市 + 仅显该时段散点（其他时段隐藏）+「× 全部时段」恢复按钮 ---- */
function drawWithCityClusters(EV, cyr, R, allMode){
  const q=(st().q||"").toLowerCase();
  const cityGroups={};                 /* { city: { period: [e,...] } } */
  const others=[];
  for(const e of EV){
    if(!matchFilter(e,false,q)) continue;
    if(!allMode && (e.year===null || Math.abs(e.year-cyr)>R)) continue;
    const city=inCity(COORDS[e.title]);
    if(city){ (cityGroups[city]=cityGroups[city]||{}); (cityGroups[city][e.period]=cityGroups[city][e.period]||[]).push(e); }
    else others.push(e);
  }
  /* 聚焦态：只显该时段散点 + 恢复按钮 */
  if(cityPeriodFocus){
    const {city, period}=cityPeriodFocus;
    const g=(cityGroups[city]||{})[period]||[];
    g.forEach(e=>addMarker(e,1, focusKey && e.title===focusKey));
    const [lat,lng]=CITY_CLUSTER[city];
    const back=L.marker([lat,lng],{icon:L.divIcon({className:'city-back',html:'<div>× 全部时段</div>',iconSize:[78,24],iconAnchor:[39,12]}),zIndexOffset:1000});
    back.bindTooltip('恢复显示全部时段',{direction:'top'});
    back.on('click',()=>{cityPeriodFocus=null;drawMarkers();});
    plainMarkers.addLayer(back);
  }else{
    /* 分堆态：每城按 period 出子簇（时段色板 + 短标 + 数量），城市坐标周边环列 */
    for(const [city,groups] of Object.entries(cityGroups)){
      const [lat,lng]=CITY_CLUSTER[city];
      for(const [period,evs] of Object.entries(groups)){
        const idx=CHAPTERS_MODERN.findIndex(c=>c.name===period);
        const pi=idx<0?0:idx;
        const ang=pi*2*Math.PI/CHAPTERS_MODERN.length;
        const pos=[lat+Math.sin(ang)*0.035, lng+Math.cos(ang)*0.035];
        const m=L.marker(pos,{icon:L.divIcon({className:'city-cluster',html:'<div style="background:'+PERIOD_COLORS[pi]+'">'+periodShort(CHAPTERS_MODERN[pi].note)+'<br>·'+evs.length+'</div>',iconSize:[58,34],iconAnchor:[29,17]})});
        m.bindTooltip(period+' · '+evs.length+' 事（点击查看该时段）',{direction:'top'});
        m.on('click',()=>{cityPeriodFocus={city,period};mapObj.setView([lat,lng],11);drawMarkers();});
        plainMarkers.addLayer(m);
      }
    }
  }
  /* 非三城事件照常渲染（含聚类/jitter） */
  others.forEach(e=>addMarker(e,1, focusKey && e.title===focusKey));
}

function popupHTML(e){
  const yr=e.yearMode==="era"?(e.era?(e.era+" · "+e.eraSub):(e.dynasty||e.period||"时代")):fmt(e);
  /* XSS 加固：title/type/summary 数据字段转义后插入（防恶意事件名注入 HTML） */
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  return '<div class="mp-t">'+esc(e.title)+'</div><div class="mp-y">'+esc(yr)+' · '+esc(e.type)+'</div><div class="mp-s">'+esc(e.summary)+'</div>';
}

function fmtYear(v){return v<0?("前 "+(-v)+" 年"):(v+" 年");}

/* ---- 自动播放：连续播放（pre 原样；hist 播放时显示最近 keepN 个事件渐透明，事件到点出现不提前） ---- */
let playing=false, playTimer=null;
let precise=false;                         /* hist 步进后精准 ±0.5；拖 slider 恢复 ±50 */
function setStep(){ yrSlider.step=mapRange==='pre'?(playing?0.001:0.01):(mapRange==='modern'||mapRange==='world-modern'?(playing?0.5:1):(mapRange==='world-ancient'?(playing?2.5:5):(playing?0.1:1))); }
function togglePlay(){
  playing=!playing;
  if(playing) cityPeriodFocus=null;      /* 播放走 keepN 路径，清城市时段聚焦 */
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
/* ---- 步进：上一个/下一个事件（按复合时间分先后；聚焦事件加粗，同年内步进滑块不动） ---- */
const stepPrev=document.getElementById("stepPrev"), stepNext=document.getElementById("stepNext");
let focusKey=null;                       /* 当前聚焦事件 title（步进定位基准） */
function stepEvent(dir){
  if(playing) togglePlay();
  precise=true;
  const v=+yrSlider.value, pre=mapRange==='pre', q=(st().q||"").toLowerCase();
  const EV=segEV();
  /* 复合时间：modern/world-* = year*13*32+month*32+day（老板规则：无月排年首、无日排月首）；hist = year*13+month（无月记13排后）；pre 仍用对数刻度 */
  const tv=e=>mapRange==='modern'||mapRange==='world-ancient'||mapRange==='world-modern'?e.year*13*32+(e.month||0)*32+(e.day||0):(e.year*13+(e.month||13));
  const yv=e=>pre?logS(Math.abs(e.year)):tv(e);
  const f=focusKey?EV.find(x=>x.title===focusKey&&matchFilter(x,pre,q)&&x.year!==null):null;
  const base=f?yv(f):(pre?v:(mapRange==='modern'||mapRange==='world-ancient'||mapRange==='world-modern'?v*416+416:v*13+13));   /* 无聚焦：从"该年底之后"起找 */
  let best=null, bestE=null;
  for(const e of EV){
    if(!matchFilter(e,pre,q)) continue;
    if(e.year===null) continue;
    const y=yv(e);
    if(dir>0 && y>base && (best===null||y<best)){best=y;bestE=e;}
    if(dir<0 && y<base && (best===null||y>best)){best=y;bestE=e;}
  }
  if(bestE){ yrSlider.value=bestE.year; focusKey=bestE.title; yrLabel.textContent=fmtYrLabel(bestE.year); drawMarkers(); }
}
stepPrev.addEventListener("click",()=>stepEvent(-1));
stepNext.addEventListener("click",()=>stepEvent(1));
/* ---- 保留事件数：连续播放时屏幕同时存在 N 个（默认 10），点击循环 10/5/3/2/1 ---- */
const keepBtn=document.getElementById("keepN");
if(keepBtn){
  keepBtn.textContent="保留 "+keepN+" 个";
  keepBtn.addEventListener("click",()=>{
    keepN=KEEP_OPTS[(KEEP_OPTS.indexOf(keepN)+1)%KEEP_OPTS.length];
    keepBtn.textContent="保留 "+keepN+" 个";
    if(playing) drawMarkers();
  });
}
function pickYearFilter(){precise=false;yrAll.classList.remove("on");yrLabel.textContent=fmtYrLabel(+yrSlider.value);drawMarkers();}
yrSlider.addEventListener("input",()=>{if(playing)togglePlay();pickYearFilter();});
yrAll.addEventListener("click",()=>{yrAll.classList.add("on");yrLabel.textContent="全部年份";drawMarkers();});
