// 排查未进入地图的事件（COORDS 缺失），按原因分类
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const m = src.match(/const EVENTS=(\[.*?\]);\s*\n\nconst CHAPTERS/s);
const events = JSON.parse(m[1]);
const cm = src.match(/const COORDS=(\{.*?\});\s*$/s);
const coords = JSON.parse(cm[1]);
const modern = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'coords_modern.json'), 'utf8'));
const chs = ['原始社会','夏商','西周','春秋','战国','秦','西汉','东汉','三国两晋南北朝','隋','唐','五代宋辽夏金','元','明','清'];

function todayName(loc) { const x = String(loc || '').match(/（(.+?)）/); return x ? x[1] : null; }

const cats = {};
const detail = {};
const noCoord = events.filter(e => !coords[e.title]);

for (const e of noCoord) {
  const loc = e.location || '';
  let cat;
  if (!loc.trim()) cat = 'A. 无location（制度/思想/著作/政策类）';
  else if (/^[国界区]/.test(loc)) cat = 'B. 区域性开头（国/界/区）';
  else {
    const t = todayName(loc);
    if (t && modern[t]) cat = 'C. 有今址且表中有坐标但COORDS未含（异常）';
    else if (t) cat = 'D. 今址表缺失（可补坐标）';
    else if (/、|；|，|及|至/.test(loc.replace(/（.+?）/g, ''))) cat = 'E. 多地点/范围（留空或选代表点）';
    else cat = 'F. 无括号今址单点（需人工定坐标）';
  }
  cats[cat] = (cats[cat] || 0) + 1;
  (detail[cat] = detail[cat] || []).push(`[${chs[e.ch]}] ${e.title}${loc ? ' (' + loc + ')' : ''}`);
}

console.log(`=== 851 条中无坐标 ${noCoord.length} 条（占比 ${(noCoord.length / events.length * 100).toFixed(0)}%）===`);
for (const [c, n] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
  console.log(`\n${c}（${n} 条）`);
  if (n <= 25) detail[c].forEach(x => console.log('  ' + x));
  else console.log('  ' + detail[c].slice(0, 25).join('\n  ') + `\n  ...共 ${n} 条`);
}
