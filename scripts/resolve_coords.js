// resolve_coords.js — 坐标解析（F3 前置工具）：分时段双通道
// 数据层统一 WGS84：CHGIS 直接产出 WGS84；高德地理编码返回 GCJ02，反转为 WGS84 再存。
// 用法:
//   node scripts/resolve_coords.js chgis <pilot.json> [--dry]   # 秦汉后(-222~1911)：CHGIS 按年份消歧
//   node scripts/resolve_coords.js amap  <pilot.json>           # 先秦(< -403)：高德地理编码今址（需环境变量 AMAP_KEY）
// 输出: data/coords_resolved.json  { title: [lat, lng] }（增量合并，不覆盖已有）
'use strict';
const fs = require('fs');
const path = require('path');

const MODE = process.argv[2];
const pilotFile = process.argv[3];
if (!MODE || !pilotFile) {
  console.error('用法: node scripts/resolve_coords.js <chgis|amap> <pilot.json>');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'coords_resolved.json');

// 本地今址坐标表（先秦通道优先查表，缺表才调高德 API）
const modernMap = fs.existsSync(path.join(ROOT, 'data', 'coords_modern.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_modern.json'), 'utf8')) : {};

// ---- GCJ02 → WGS84（高德地理编码结果反转；数据层统一 WGS84） ----
function gcj02ToWgs84(lat, lng) {
  const a = 6378245.0, ee = 0.00669342162296594323;
  function tx(x, y) {
    let r = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI))*2/3;
    r += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30))*2/3;
    return r;
  }
  function ty(x, y) {
    let r = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI))*2/3;
    r += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI))*2/3;
    return r;
  }
  // 迭代法反解
  let wLat = lat, wLng = lng;
  for (let i = 0; i < 6; i++) {
    const dLat = tx(wLng - 105, wLat - 35), dLng = ty(wLng - 105, wLat - 35);
    const rad = wLat/180*Math.PI, magic = 1 - ee*Math.sin(rad)*Math.sin(rad), sq = Math.sqrt(magic);
    const flat = dLat*180/((a*(1-ee))/(magic*sq)*Math.PI);
    const flng = dLng*180/(a/sq*Math.cos(rad)*Math.PI);
    wLat = lat - flat; wLng = lng - flng;
  }
  return [wLat, wLng];
}

// ---- location "古名（今址）" → 提取今址 ----
function todayName(loc) {
  const m = String(loc || '').match(/（(.+?)）/);
  return m ? m[1] : null;
}
function plainName(loc) {
  const m = String(loc || '').match(/^(.+?)（/);
  return m ? m[1].trim() : String(loc || '').trim();
}

// ---- CHGIS 查询（免费公开，无 key；覆盖 -222~1911，先秦零覆盖）
// 2026-08-02 实测：返回结构为 placenames[]，坐标为 "xy coordinates"（"lng, lat"，WGS84） ----
async function chgisQuery(name, year) {
  const url = `https://chgis.hudci.org/tgaz/placename?n=${encodeURIComponent(name)}&yr=${year}&fmt=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CHGIS HTTP ' + res.status);
  const data = await res.json();
  const p = data && data.placenames && data.placenames[0];
  if (p && p['xy coordinates']) {
    const [lng, lat] = p['xy coordinates'].split(',').map(Number);
    return [lat, lng]; // WGS84
  }
  return null;
}

// ---- 高德地理编码（需服务端 key；返回 GCJ02 → 反转为 WGS84） ----
async function amapQuery(addr) {
  const key = process.env.AMAP_KEY;
  if (!key) throw new Error('缺环境变量 AMAP_KEY（高德服务端 key，非浏览器 key）');
  const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(addr)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('AMAP HTTP ' + res.status);
  const data = await res.json();
  const g = data && data.geocodes && data.geocodes[0];
  if (g && g.location) {
    const [lng, lat] = g.location.split(',').map(Number);
    return gcj02ToWgs84(lat, lng); // 反转为 WGS84 统一存储
  }
  return null;
}

// ---- CHGIS 古名别名表（CHGIS 收录名与教材/数据常用名不一致时）----
// 例：东汉"洛阳"当时称"雒阳"（CHGIS 按雒阳县收录 23~264）；"钜鹿"异体"巨鹿"
const CHGIS_ALIAS = {
  '洛阳': ['洛阳', '雒阳', '洛陽'],
  '钜鹿': ['钜鹿', '巨鹿'],
  '鄯善': ['鄯善', '鄯善县'],
  '于阗': ['于阗', '于阗县', '和田'],
  '伊吾卢': ['伊吾卢', '伊吾'],
  '成皋': ['成皋', '成皋县', '汜水'],
  '京口': ['京口', '京口县'],
};

// ---- 主流程 ----
(async () => {
  const pilot = JSON.parse(fs.readFileSync(pilotFile, 'utf8'));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const out = { ...prev };
  let done = 0, fail = 0, skip = 0;

  for (const e of pilot) {
    if (prev[e.title]) { skip++; continue; }        // 已有坐标，跳过
    const loc = e.location;
    // 跳过：空 location / 国名区域开头（"国""界""区"）
    if (!loc || /^[国界区]/.test(loc)) { fail++; console.log(`[跳过 location 无效] ${e.title}: "${loc}"`); continue; }
    // amap（先秦）模式必须带今址括号；chgis（秦汉后）模式纯政区名即可
    if (MODE === 'amap' && plainName(loc) === loc) { fail++; console.log(`[跳过 先秦无今址] ${e.title}: "${loc}"`); continue; }
    let coord = null;
    try {
      if (MODE === 'chgis') {
        const yr = e.yearMode === 'range' ? e.yearRange[0] : e.year;
        if (yr == null) { skip++; continue; }       // era 无年份，CHGIS 无法消歧
        const base = plainName(loc);
        const names = CHGIS_ALIAS[base] || [base];
        for (const n of names) {
          coord = await chgisQuery(n, yr);
          if (coord) break;
        }
        if (!coord) {
          // 今址兜底：location 带"（今址）"时查本地今址表
          const t = todayName(loc);
          if (t && modernMap[t]) { coord = modernMap[t]; }
          else { console.log(`[CHGIS+今址未命中] ${e.title}(${base} yr=${yr} 今址=${t || '-'})`); fail++; continue; }
        }
      } else if (MODE === 'amap') {
        const addr = todayName(loc) || plainName(loc);
        if (modernMap[addr]) { coord = modernMap[addr]; }   // 本地表优先（零 API）
        else if (process.env.AMAP_KEY) { coord = await amapQuery(addr); }
        if (!coord) { console.log(`[坐标缺失] ${e.title}(${addr}) → 请补 data/coords_modern.json 或设 AMAP_KEY`); fail++; continue; }
      } else { throw new Error('未知模式: ' + MODE); }
    } catch (err) {
      console.log(`[ERR] ${e.title}: ${err.message}`); fail++; continue;
    }
    out[e.title] = coord.map(v => Math.round(v * 1e6) / 1e6);
    done++;
    await new Promise(r => setTimeout(r, 300));      // 节流
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log('----');
  console.log(`解析 ${done}，失败 ${fail}，跳过(已有/era) ${skip} → ${OUT}`);
})();
