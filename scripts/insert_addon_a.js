// 插入 A 组补录：按 dynasty 归入各章文件，保持各文件原 JSON 格式
const fs = require('fs');
const path = require('path');
const ADDON = require('./addon_a');

const ROOT = path.join(__dirname, '..');
// dynasty → 章文件
const DYN_FILE = {
  '商': '夏商_pilot_20260802.json',
  '战国': '战国_pilot_20260801.json',
  '西汉': '西汉_pilot_20260802.json',
  '东汉': '东汉.json',
  '三国两晋南北朝': '三国两晋南北朝.json',
  '东晋': '三国两晋南北朝.json',
  '北魏': '三国两晋南北朝.json',
  '南朝宋': '三国两晋南北朝.json',
  '唐': '唐.json',
  '北宋': '五代宋辽金西夏.json',
  '金': '五代宋辽金西夏.json',
  '南宋': '五代宋辽金西夏.json',
  '元': '元代_pilot_20260802.json',
  '明': '明.json',
  '清': '清前期.json',
};

// 检测文件格式：数组字段内联 还是 展开
// 内联示例: "people": ["朱温"]   展开示例: "people": [\n      "成吉思汗"
function detectFmt(raw) {
  const m = raw.match(/"people":\s*\[(\s*)/);
  if (!m) return 'inline';
  return m[1].includes('\n') ? 'expanded' : 'inline';
}
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

// 分组
const byFile = {};
for (const e of ADDON) {
  const f = DYN_FILE[e.dynasty];
  if (!f) { console.error('未映射 dynasty:', e.dynasty, e.title); process.exit(1); }
  (byFile[f] = byFile[f] || []).push(e);
}

const report = [];
for (const [f, items] of Object.entries(byFile)) {
  const file = path.join(ROOT, 'data', f);
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : Object.values(data);
  // 防重复（脚本可重跑）
  const exist = new Set(arr.map(e => e.title));
  let added = 0;
  for (const it of items) {
    if (exist.has(it.title)) { report.push(`${f}: 跳过已存在 ${it.title}`); continue; }
    arr.push(it); added++;
  }
  const fmt = detectFmt(raw);
  const out = fmt === 'expanded' ? JSON.stringify(arr, null, 2) : fmtInline(arr, 0);
  fs.writeFileSync(file, out + '\n', 'utf8');
  report.push(`${f}: ${fmt}格式, 新增 ${added} 条 → 共 ${arr.length} 条`);
}
console.log(report.join('\n'));
console.log('总计:', ADDON.length, '条');
