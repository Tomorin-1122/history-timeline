/* common.js — 通用工具函数（无 DOM 依赖，可被 timeline/map/review 共用） */
'use strict';

/* 史前年份"万年"格式化：1700000 → "170万年"；18000 → "1.8万年" */
function fmtWan(absYear){
  const w = absYear / 10000;
  return (Number.isInteger(w) ? String(w) : w.toFixed(1)) + '万年';
}

/* 单个年份格式化：负数为公元前（"前 632"）、正数为公元后（"1271"） */
function fmtY(v){ return v<0?("前 "+(-v)):(""+v); }

/* 年份展示：exact="前 632" approx="约前 1600" range="前 579 至 前 546"/"1219 至 1224" era=null
   史前（|year|>=10000）统一用"距今约 X 万年"单位 */
function fmt(e){
  if(e.yearMode==="era") return null;
  if(e.yearMode==="range"){
    const a=e.yearRange[0], b=e.yearRange[1];
    if(Math.abs(a)>=10000) return "距今约 "+fmtWan(Math.abs(a))+" 至 "+fmtWan(Math.abs(b));
    return fmtY(a)+" 至 "+fmtY(b);   /* 正负各按 fmtY：公元前加"前"，公元后不加 */
  }
  if(e.year<0){
    const abs=-e.year;
    if(abs>=10000) return "距今约 "+fmtWan(abs);
    return (e.yearMode==="approx"?"约":"")+"前 "+abs;
  }
  return (e.yearMode==="approx"?"约":"")+e.year;
}

/* 时间轴/地图短格式：前 632 / 约前 1600 / 前 579~546 / 1219~1224 / era 返回时段文案；史前同用"万年"
   有 month 的事件显示到月（"1912年2月"），不显示具体日期（避免记忆负担；同月事件视为同时） */
function fmtShort(e){
  if(e.yearMode==="era") return e.era||e.dynasty||e.period||"时代";
  if(e.yearMode==="range"){
    const a=e.yearRange[0], b=e.yearRange[1];
    if(Math.abs(a)>=10000) return "距今"+fmtWan(Math.abs(a))+"~"+fmtWan(Math.abs(b));
    return a<0?("前 "+(-a)+"~"+(-b)):(a+"~"+b);  /* 公元前"前 579~546"、公元后"1219~1224" */
  }
  if(e.year<0){
    const abs=-e.year;
    if(abs>=10000) return "距今约"+fmtWan(abs);
    return (e.yearMode==="approx"?"约":"")+"前 "+abs+(e.month?("年"+e.month+"月"):"");
  }
  return (e.yearMode==="approx"?"约":"")+e.year+(e.month?("年"+e.month+"月"):"");
}

/* 星级：importance 1-3 */
function stars(n){
  let s="";
  for(let i=1;i<=3;i++) s+= i<=n ? "★" : '<span class="off">★</span>';
  return s;
}

/* 洗牌（原地） */
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

/* 事件命中搜索词：标题/摘要/地点/考点提示/标签/人物/朝代 */
function matchEvent(e,q){
  const hay=[e.title,e.summary||"",e.location||"",e.examTip||"",(e.tags||[]).join(" "),e.dynasty||"",(e.people||[]).join(" ")].join(" ").toLowerCase();
  return hay.indexOf(q)>=0;
}

/* WGS84 → GCJ02（备用：高德瓦片叠加需转换；天地图/CGCS2000 免转换） */
function wgs84ToGcj02(lat,lng){
  const a=6378245.0, ee=0.00669342162296594323;
  function tx(x,y){
    let r=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
    r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;
    r+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;
    return r;
  }
  function ty(x,y){
    let r=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
    r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;
    r+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;
    return r;
  }
  const dlat=tx(lng-105,lat-35), dlng=ty(lng-105,lat-35);
  const rad=lat/180*Math.PI, magic=1-ee*Math.sin(rad)*Math.sin(rad), sq=Math.sqrt(magic);
  const flat=dlat*180/(a*(1-ee)/(magic*sq)*Math.PI);
  const flng=dlng*180/(a/sq*Math.cos(rad)*Math.PI);
  return [lat+flat,lng+flng];
}
