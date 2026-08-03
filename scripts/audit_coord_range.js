// 坐标质量审计：location 今址省份 vs 坐标范围 匹配校验
// 捕获 CHGIS 同名消歧错误（如 宁远→湖南 vs 辽宁、西宁→广东 vs 青海）
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const events = JSON.parse(src.match(/const EVENTS=(\[.*?\]);\s*\n\nconst CHAPTERS/s)[1]);
const coords = JSON.parse(src.match(/const COORDS=(\{.*?\});\s*$/s)[1]);

// 中国省级行政区大致经纬度范围（latMin,latMax,lngMin,lngMax）
const PROV = {
  '辽宁': [38.7, 43.5, 118.8, 125.8], '青海': [31.4, 39.2, 89.4, 103.1], '广东': [20.2, 25.5, 109.7, 117.3],
  '河北': [36.0, 42.6, 113.4, 119.9], '河南': [31.4, 36.4, 110.4, 116.7], '山西': [34.6, 40.7, 110.2, 114.6],
  '陕西': [31.7, 39.6, 105.5, 111.2], '山东': [34.4, 38.4, 114.8, 122.7], '江苏': [30.7, 35.1, 116.4, 121.9],
  '浙江': [27.2, 31.2, 118.0, 122.5], '安徽': [29.4, 34.6, 114.9, 119.6], '福建': [23.5, 28.3, 115.8, 120.7],
  '江西': [24.5, 30.1, 113.6, 118.5], '湖南': [24.6, 30.1, 108.8, 114.3], '湖北': [29.0, 33.3, 108.3, 116.1],
  '四川': [26.0, 34.3, 97.4, 108.5], '云南': [21.1, 29.2, 97.5, 106.2], '贵州': [24.6, 29.2, 103.6, 109.6],
  '广西': [20.9, 26.4, 104.5, 112.0], '甘肃': [32.6, 42.8, 92.3, 108.7], '宁夏': [35.2, 39.4, 104.3, 107.7],
  '内蒙古': [37.4, 53.3, 97.2, 126.1], '黑龙江': [43.4, 53.6, 121.2, 135.1], '吉林': [40.9, 46.3, 121.6, 131.3],
  '北京': [39.4, 41.1, 115.4, 117.5], '天津': [38.6, 40.2, 116.7, 118.1], '上海': [30.7, 31.9, 120.9, 122.1],
  '新疆': [34.3, 49.2, 73.5, 96.4], '西藏': [26.9, 36.5, 78.4, 99.1], '海南': [18.2, 20.2, 108.6, 111.1],
  '台湾': [21.9, 25.3, 120.0, 122.0],
};
const PROV_ORDER = ['黑龙江','内蒙古','辽宁','青海','西藏','新疆','广东','河北','河南','山西','陕西','山东','江苏','浙江','安徽','福建','江西','湖南','湖北','四川','云南','贵州','广西','甘肃','宁夏','吉林','北京','天津','上海','海南','台湾'];

const chs = ['原始社会','夏商','西周','春秋','战国','秦','西汉','东汉','三国两晋南北朝','隋','唐','五代宋辽夏金','元','明','清'];
function provOf(today) {
  if (!today) return null;
  for (const p of PROV_ORDER) if (today.includes(p)) return p;
  return null; // 不含省名（如"今北京""今澳门"）
}

let checked = 0, suspect = [], skip = 0;
for (const e of events) {
  const c = coords[e.title];
  if (!c) continue;
  checked++;
  const m = String(e.location || '').match(/（(.+?)）/);
  const today = m ? m[1] : null;
  const prov = provOf(today);
  if (!prov) { skip++; continue; }  // 无法用省份校验的跳过（北京/澳门/境外等）
  const [laMin, laMax, loMin, loMax] = PROV[prov];
  const [lat, lng] = c;
  if (lat < laMin || lat > laMax || lng < loMin || lng > loMax) {
    suspect.push(`[${chs[e.ch]}] ${e.title} | 今址:${today} | 应在${prov} | 坐标:${lat.toFixed(2)},${lng.toFixed(2)}`);
  }
}
console.log(`已校验 ${checked} 条（含省份今址 ${checked - skip} 条），疑似异常 ${suspect.length} 条:`);
suspect.forEach(s => console.log(' ⚠️', s));
