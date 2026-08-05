// 按老板核验意见补坐标：46 条确定项（coords_resolved 坐标 + data 各章 location 同步）
const fs = require('fs');
const path = require('path');

// title → [新location, [lat,lng]]
const FIX = {
  // 原始社会
  '尧': ['陶寺遗址（今山西襄汾）', [35.88, 111.49]],
  // 夏商
  '启世袭王权': ['阳翟（今河南禹州）', [34.14, 113.49]],
  '太康失国': ['偃师二里头（今河南洛阳偃师）', [34.69, 112.70]],
  '少康中兴': ['帝丘（今河南濮阳南）', [35.76, 115.03]],
  // 西周
  '宣王料民': ['太原（今山西太原）', [37.87, 112.55]],
  // 春秋
  '作州兵': ['翼城（今山西翼城东南）', [35.73, 111.72]],
  '秦穆公霸西戎': ['雍城（今陕西凤翔）', [34.52, 107.40]],
  '老子与《道德经》': ['苦县（今河南鹿邑）', [33.86, 115.48]],
  // 战国
  '李悝变法': ['安邑（今山西夏县西北）', [35.14, 111.22]],
  '武卒制': ['西河（今陕西东部黄河沿岸）', [35.50, 110.50]],
  '吴起变法': ['郢都（今湖北荆州）', [30.33, 112.24]],
  '申不害变法': ['新郑（今河南新郑）', [34.40, 113.74]],
  '齐威王改革': ['临淄（今山东淄博临淄）', [36.82, 118.31]],
  '燕王哙让国': ['蓟城（今北京）', [39.89, 116.35]],
  '鸿沟': ['大梁（今河南开封）', [34.80, 114.31]],
  '秦灭巴蜀': ['成都（今四川成都）', [30.57, 104.07]],
  '苏秦合纵攻秦': ['函谷关（今河南灵宝）', [34.62, 110.94]],
  '赵武灵王胡服骑射': ['邯郸（今河北邯郸）', [36.63, 114.54]],
  '韩非': ['咸阳（今陕西西安）', [34.34, 108.94]],
  '墨家与墨子': ['鲁国（今山东滕州）', [35.08, 117.16]],
  // 西汉
  '文景之治': ['长安（今陕西西安）', [34.34, 108.94]],
  '察举制': ['长安（今陕西西安）', [34.34, 108.94]],
  '楼车发明': ['长安（今陕西西安）', [34.34, 108.94]],
  '丝绸之路开辟': ['长安（今陕西西安）', [34.34, 108.94]],
  '昭君出塞': ['匈奴王庭（今内蒙古呼和浩特）', [40.84, 111.75]],
  '造纸术发明': ['洛阳（今河南洛阳）', [34.62, 112.45]],
  '王莽改制': ['长安（今陕西西安）', [34.34, 108.94]],
  // 三国两晋南北朝
  '关东军讨伐董卓': ['酸枣（今河南延津）', [35.14, 114.20]],
  '九品中正制确立': ['洛阳（今河南洛阳）', [34.62, 112.45]],
  '蜀吴重新结盟': ['武昌（今湖北鄂州）', [30.39, 114.89]],
  '朱应康泰出使南海': ['建业（今江苏南京）', [32.06, 118.80]],
  '前秦统一北方': ['长安（今陕西西安）', [34.34, 108.94]],
  '北魏统一北方': ['平城（今山西大同）', [40.08, 113.30]],
  '西魏府兵制建立': ['长安（今陕西西安）', [34.34, 108.94]],
  // 隋
  '启民可汗降隋': ['长安（今陕西西安）', [34.34, 108.94]],
  '日本遣隋使来华': ['洛阳（今河南洛阳）', [34.62, 112.45]],
  '巢元方《诸病源候论》成书': ['洛阳（今河南洛阳）', [34.62, 112.45]],
  // 唐
  '鉴真东渡': ['明州（今浙江宁波）', [29.87, 121.54]],
  // 五代宋辽夏金
  '石敬瑭割让幽云十六州': ['蓟州（今北京）', [39.90, 116.40]],
  '周世宗南征': ['寿春（今安徽寿县）', [32.58, 116.79]],
  '毕昇发明活字印刷': ['杭州（今浙江杭州）', [30.27, 120.16]],
  '辽灭亡': ['应州（今山西应县）', [39.55, 113.19]],
  '开禧北伐': ['宿州（今安徽宿州）', [33.65, 116.98]],
  // 元
  '忽必烈与阿里不哥之争': ['开平（今内蒙古正蓝旗）', [42.35, 116.21]],
  // 明
  '明末农民战争': ['米脂（今陕西米脂）', [37.76, 110.18]],
  // 清
  '布连斯奇条约': ['波尔河畔（今俄罗斯恰克图附近）', [50.40, 106.55]],
};

const ROOT = path.join(__dirname, '..');
// 1. 更新 coords_resolved.json
const resF = path.join(ROOT, 'data', 'coords_resolved.json');
const resolved = JSON.parse(fs.readFileSync(resF, 'utf8'));
let coordN = 0;
for (const [t, [loc, c]] of Object.entries(FIX)) {
  if (resolved[t] && !['','0'].includes(resolved[t].join(','))) { console.log('⚠️ 已有坐标跳过:', t, resolved[t]); continue; }
  resolved[t] = c; coordN++;
}
fs.writeFileSync(resF, JSON.stringify(resolved, null, 1) + '\n', 'utf8');
console.log(`coords_resolved 新增 ${coordN} 条 → 共 ${Object.keys(resolved).length}`);

// 2. 更新各章 data 文件 location（保持原格式）
const DYN_FILE = {
  '原始社会': '原始社会.json', '夏商': '夏商.json', '西周': '西周.json',
  '春秋': '春秋.json', '战国': '战国.json', '秦': '秦.json',
  '西汉': '西汉.json', '东汉': '东汉.json', '三国两晋南北朝': '三国两晋南北朝.json',
  '隋': '隋.json', '唐': '唐.json', '五代宋辽夏金': '五代宋辽金西夏.json', '元': '元代.json',
  '明': '明.json', '清': '清前期.json',
};
function detectFmt(raw) { const m = raw.match(/"people":\s*\[(\s*)/); return (m && m[1].includes('\n')) ? 'expanded' : 'inline'; }
function fmtInline(v, depth) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(v)) {
    if (depth === 0) return '[\n' + v.map(x => pad + '  ' + fmtInline(x, depth + 1)).join(',\n') + '\n' + pad + ']';
    return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v);
    return '{\n' + ks.map(k => pad + '  ' + JSON.stringify(k) + ': ' + fmtInline(v[k], depth + 1)).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(v);
}
// 读 data.js 拿每个 title 的 ch（dynasty 文件名映射需全量）
const src = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const events = JSON.parse(src.match(/const EVENTS=(\[.*?\]);\s*\n\nconst CHAPTERS/s)[1]);
const chNames = ['原始社会','夏商','西周','春秋','战国','秦','西汉','东汉','三国两晋南北朝','隋','唐','五代宋辽夏金','元','明','清'];
const titleCh = {};
events.forEach(e => titleCh[e.title] = chNames[e.ch]);

const changed = {};
for (const [t, [loc]] of Object.entries(FIX)) {
  const ch = titleCh[t];
  if (!ch) { console.log('⚠️ 找不到章节:', t); continue; }
  const file = DYN_FILE[ch];
  if (!file) { console.log('⚠️ 无文件映射:', t, ch); continue; }
  (changed[file] = changed[file] || []).push([t, loc]);
}
let locN = 0;
for (const [file, items] of Object.entries(changed)) {
  const fp = path.join(ROOT, 'data', file);
  const raw = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : Object.values(data);
  for (const [t, loc] of items) {
    const e = arr.find(x => x.title === t);
    if (e) { e.location = loc; locN++; }
  }
  const fmt = detectFmt(raw);
  const out = fmt === 'expanded' ? JSON.stringify(arr, null, 2) : fmtInline(arr, 0);
  fs.writeFileSync(fp, out + '\n', 'utf8');
}
console.log(`location 更新 ${locN} 条，涉及 ${Object.keys(changed).length} 个文件`);
