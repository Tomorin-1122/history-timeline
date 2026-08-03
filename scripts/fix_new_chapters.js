// 三章数据清洗修复：related 悬空 / 跨章重复删除 / location 补全
const fs = require('fs');
const path = require('path');

function load(f) {
  return JSON.parse(fs.readFileSync(path.join('data', f + '.json'), 'utf8'));
}
// 自定义格式化：对象展开 2 空格、数组内联（匹配原文件格式，避免全量 diff）
function fmt(v, depth, topLevel) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(v)) {
    if (topLevel) {
      if (v.length === 0) return '[]';
      return '[\n' + v.map(x => pad + '  ' + fmt(x, depth + 1, false)).join(',\n') + '\n' + pad + ']';
    }
    return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
  }
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{\n' + keys.map(k => pad + '  ' + JSON.stringify(k) + ': ' + fmt(v[k], depth + 1, false)).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(v);
}
function save(f, d) {
  // 保持原格式：数组写数组，数字键对象写对象
  const out = Array.isArray(d) ? d : Object.fromEntries(Object.entries(d));
  fs.writeFileSync(path.join('data', f + '.json'), fmt(out, 0, true) + '\n', 'utf8');
}
function arrOf(d) { return Array.isArray(d) ? d : Object.values(d); }
function find(d, title) { return arrOf(d).find(e => e.title === title); }
function fixRelated(e, removeList, addMap) {
  if (!Array.isArray(e.related)) e.related = [];
  for (const r of removeList) e.related = e.related.filter(x => x !== r);
  for (const [oldT, newT] of Object.entries(addMap)) {
    const i = e.related.indexOf(oldT);
    if (i !== -1) e.related[i] = newT;
  }
}
function fixLocation(e, loc) {
  if (!e.location || !String(e.location).trim()) e.location = loc;
}

const report = [];

// ════════ 1. 五代宋辽金西夏 ════════
let d5 = load('五代宋辽金西夏');
const fix5 = [
  ['石敬瑭割让幽云十六州', { remove: ['辽太宗取得幽云十六州'] }],
  ['后汉建立', { remove: ['后晋建立'] }],
  // 周世宗系列：直接赋值期望 related（避免先删后改的顺序问题）
  ['高平之战', { set: ['周世宗颁均田图'] }],
  ['周世宗抑佛', { set: ['周世宗颁均田图', '周世宗颁《大周刑统》'] }],
  ['周世宗颁均田图', { set: ['周世宗抑佛', '周世宗颁《大周刑统》'] }],
  ['周世宗颁《大周刑统》', { set: ['周世宗抑佛', '周世宗颁均田图'] }],
  ['庆历新政', { remove: ['王安石变法'] }],
  ['元祐更化', { remove: ['王安石变法'] }],
  ['哲宗绍述', { remove: ['王安石变法'] }],
];
for (const [t, { remove, add, set }] of fix5) {
  const e = find(d5, t);
  if (set) { e.related = set; }
  else { fixRelated(e, remove || [], add || {}); }
  report.push(`五代:${t} related → ${JSON.stringify(e.related)}`);
}
// location 补全（和议/盟约类）
const loc5 = [
  ['宋夏和议', '开封（今河南开封）'],
  ['庆历和议', '开封（今河南开封）'],
  ['海上之盟', '汴京（今河南开封）'],
  ['绍兴和议', '临安（今浙江杭州）'],
  ['隆兴和议', '临安（今浙江杭州）'],
  ['嘉定和议', '临安（今浙江杭州）'],
];
for (const [t, loc] of loc5) {
  const e = find(d5, t);
  fixLocation(e, loc);
  report.push(`五代:${t} location → ${e.location}`);
}
save('五代宋辽金西夏', d5);

// ════════ 2. 明 ════════
let dM = load('明');
// related 修复
fixRelated(find(dM, '明代科举制度'), [], { '《永乐大典》': '《永乐大典》的编纂' });
fixRelated(find(dM, '废除丞相制度'), ['内阁制度形成'], {});
fixRelated(find(dM, '《大诰》的颁行'), [], { '《大明律》': '《大明律》的颁行' });
fixRelated(find(dM, '利玛窦与西学东渐'), [], { '《崇祯历书》的编修': '崇祯历书的编修' });
report.push(`明:明代科举制度 related → ${JSON.stringify(find(dM,'明代科举制度').related)}`);
report.push(`明:废除丞相制度 related → ${JSON.stringify(find(dM,'废除丞相制度').related)}`);
report.push(`明:《大诰》的颁行 related → ${JSON.stringify(find(dM,'《大诰》的颁行').related)}`);
report.push(`明:利玛窦与西学东渐 related → ${JSON.stringify(find(dM,'利玛窦与西学东渐').related)}`);
// 删除山海关之战 + 修复相关引用
const delM = find(dM, '山海关之战');
if (delM) {
  const i = arrOf(dM).indexOf(delM);
  arrOf(dM).splice(i, 1);
  for (const e of arrOf(dM)) {
    if (Array.isArray(e.related) && e.related.includes('山海关之战')) {
      e.related = e.related.filter(x => x !== '山海关之战');
      report.push(`明:${e.title} 删除 related 引用[山海关之战] → ${JSON.stringify(e.related)}`);
    }
  }
  report.push('明:删除条目[山海关之战]');
}
save('明', dM);

// ════════ 3. 元代_pilot（删除襄樊之战 + 修复引用） ════════
// 注意：元代章原文件为数组展开格式，用 JSON.stringify 匹配，避免全量 diff
let dY = load('元代_pilot_20260802');
const delY = find(dY, '襄樊之战');
if (delY) {
  const i = arrOf(dY).indexOf(delY);
  arrOf(dY).splice(i, 1);
  for (const e of arrOf(dY)) {
    if (Array.isArray(e.related) && e.related.includes('襄樊之战')) {
      e.related = e.related.filter(x => x !== '襄樊之战');
      report.push(`元代:${e.title} 删除 related 引用[襄樊之战] → ${JSON.stringify(e.related)}`);
    }
  }
  report.push('元代:删除条目[襄樊之战]');
}
const outY = Array.isArray(dY) ? dY : Object.fromEntries(Object.entries(dY));
fs.writeFileSync(path.join('data', '元代_pilot_20260802.json'), JSON.stringify(outY, null, 2) + '\n', 'utf8');

console.log('===== 修改报告 =====');
report.forEach(r => console.log(r));
