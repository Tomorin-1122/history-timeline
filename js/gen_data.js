// gen_data.js — 把 pilot JSON 合并转换为正式版 js/data.js（node 运行）
// 用法: node js/gen_data.js
// 输出: js/data.js （全局 const EVENTS / CHAPTERS / COORDS，file:// 可直接加载）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---- 15 章定义（正式版全量，索引即 ch 字段） ----
const CHAPTERS = [
  { id: 'c1',  no: '第一章',   name: '原始社会',       note: '距今约一百七十万年 至 前2070年' },
  { id: 'c2',  no: '第二章',   name: '夏商',           note: '前2070年 至 前1046年' },
  { id: 'c3',  no: '第三章',   name: '西周',           note: '前1046年 至 前771年' },
  { id: 'c4',  no: '第四章',   name: '春秋',           note: '前770年 至 前476年' },
  { id: 'c5',  no: '第五章',   name: '战国',           note: '前475年 至 前221年' },
  { id: 'c6',  no: '第六章',   name: '秦',             note: '前221年 至 前207年' },
  { id: 'c7',  no: '第七章',   name: '西汉',           note: '前202年 至 8年' },
  { id: 'c8',  no: '第八章',   name: '东汉',           note: '25年 至 220年' },
  { id: 'c9',  no: '第九章',   name: '三国两晋南北朝', note: '220年 至 589年' },
  { id: 'c10', no: '第十章',   name: '隋',             note: '581年 至 618年' },
  { id: 'c11', no: '第十一章', name: '唐',             note: '618年 至 907年' },
  { id: 'c12', no: '第十二章', name: '五代宋辽夏金',   note: '907年 至 1279年' },
  { id: 'c13', no: '第十三章', name: '元',             note: '1271年 至 1368年' },
  { id: 'c14', no: '第十四章', name: '明',             note: '1368年 至 1644年' },
  { id: 'c15', no: '第十五章', name: '清',             note: '1644年 至 1840年' },
];

// dynasty（pilot 值）→ ch 索引
const DYN_TO_CH = {
  '原始社会': 0, '夏商': 1, '夏': 1, '商': 1, '西周': 2, '春秋': 3, '战国': 4, '秦': 5,
  '西汉': 6, '新': 6, '东汉': 7, '三国两晋南北朝': 8, '隋': 9, '唐': 10,
  '五代宋辽夏金': 11, '五代': 11, '元': 12, '元代': 12, '明': 13, '清': 14,
  // 第 8 章（三国两晋南北朝）细分政权：归 ch=8
  '东汉末年': 8, '三国': 8, '曹魏': 8, '蜀汉': 8, '孙吴': 8,
  '西晋': 8, '东晋': 8, '十六国': 8,
  '成汉': 8, '前赵': 8, '后赵': 8, '前燕': 8, '前秦': 8, '后燕': 8, '后秦': 8,
  '西秦': 8, '后凉': 8, '南凉': 8, '北凉': 8, '南燕': 8, '西凉': 8, '大夏': 8, '北燕': 8,
  '北魏': 8, '东魏': 8, '西魏': 8, '北齐': 8, '北周': 8,
  '南朝宋': 8, '南齐': 8, '萧梁': 8, '南朝陈': 8,
  // 第 10 章（唐）跨章边界/武周：归 ch=10
  '隋末': 10, '武周': 10,
  // 第 12 章（五代宋辽夏金）细分政权
  '后梁': 11, '后唐': 11, '后晋': 11, '后汉': 11, '后周': 11,
  '吴越': 11, '辽': 11, '大理': 11, '北宋': 11, '西夏': 11, '金': 11, '南宋': 11, '蒙古': 11,
  // 第 15 章（清）南明：归 ch=14
  '南明': 14,
};

// ---- 试点 pilot 文件（位于 data/ 目录） ----
const PILOTS = [
  ['原始社会', 'data/原始社会_pilot_20260802.json'],
  ['夏商', 'data/夏商_pilot_20260802.json'],
  ['西周', 'data/西周_pilot_20260802.json'],
  ['春秋', 'data/春秋_pilot_20260802.json'],
  ['战国', 'data/战国_pilot_20260801.json'],
  ['秦', 'data/秦_pilot_20260802.json'],
  ['西汉', 'data/西汉_pilot_20260802.json'],
  ['东汉', 'data/东汉.json'],
  ['三国两晋南北朝', 'data/三国两晋南北朝.json'],
  ['隋', 'data/隋.json'],
  ['唐', 'data/唐.json'],
  ['五代宋辽夏金', 'data/五代宋辽金西夏.json'],
  ['元代', 'data/元代_pilot_20260802.json'],
  ['明', 'data/明.json'],
  ['清', 'data/清前期.json'],
];

// ---- 读坐标来源（优先级：coords_resolved 历史坐标 > coords_modern 今址表 > coords_demo 打样） ----
function loadJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch (e) { console.warn(file + ' 读取失败:', e.message); return {}; }
}
const histCoords = loadJson('data/coords_resolved.json');   // CHGIS 历史坐标（按 title）
const modernCoords = loadJson('data/coords_modern.json');   // 今址坐标表（按"今址"）
const demoCoords = loadJson('data/coords_demo.json');       // demo 打样（按 title）

function todayName(loc) {
  const m = String(loc || '').match(/（(.+?)）/);
  return m ? m[1] : null;
}

// ---- 字段白名单与必填校验 ----
const REQ = ['title', 'year', 'yearMode', 'yearRange', 'dynasty', 'period', 'type', 'importance',
  'summary', 'cause', 'effect', 'examTip', 'people', 'location', 'tags', 'related', 'wikiSlug'];

function main() {
  const events = [];
  const errs = [];
  let chMiss = {};

  for (const [tag, file] of PILOTS) {
    const p = path.join(ROOT, file);
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { errs.push(`[${tag}] 读取失败: ${e.message}`); continue; }
    if (!Array.isArray(data)) { errs.push(`[${tag}] 不是数组`); continue; }

    data.forEach((it, i) => {
      const missing = REQ.filter(k => !(k in it));
      if (missing.length) { errs.push(`[${tag}#${i} ${it.title || '?'}] 缺字段 ${missing}`); return; }
      const ch = DYN_TO_CH[it.dynasty];
      if (ch === undefined) { chMiss[it.dynasty] = (chMiss[it.dynasty] || 0) + 1; return; }
      events.push({
        title: it.title,
        year: it.year,
        yearMode: it.yearMode,
        yearRange: it.yearRange,
        era: it.era || '', eraSub: it.eraSub || '',   // 透传 pilot 的 era/eraSub（era 模式必填 era）
        ch,
        dynasty: it.dynasty,
        period: it.period,
        type: it.type,
        importance: it.importance,
        summary: it.summary,
        cause: it.cause,
        effect: it.effect,
        examTip: it.examTip,
        people: it.people,
        location: it.location,
        tags: it.tags,
        related: it.related,
        wikiSlug: it.wikiSlug,
      });
    });
  }

  if (Object.keys(chMiss).length) errs.push(`未映射的 dynasty: ${JSON.stringify(chMiss)}`);
  if (errs.length) { console.error('ERRORS:\n - ' + errs.join('\n - ')); process.exit(1); }

  // COORDS：历史坐标 > 今址表 > demo 打样
  const coords = {};
  events.forEach(e => {
    if (histCoords[e.title]) { coords[e.title] = histCoords[e.title]; return; }
    const t = todayName(e.location);
    if (t && modernCoords[t]) { coords[e.title] = modernCoords[t]; return; }
    if (demoCoords[e.title]) coords[e.title] = demoCoords[e.title];
  });

  const out = '// 自动生成，勿手改 — 由 js/gen_data.js 从 *_pilot_*.json 合并产出（F2 数据关卡前为试点基线）\n'
    + `const EVENTS=${JSON.stringify(events, null, 1)};\n\n`
    + `const CHAPTERS=${JSON.stringify(CHAPTERS, null, 1)};\n\n`
    + `const COORDS=${JSON.stringify(coords, null, 1)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'data.js'), out, 'utf8');

  console.log(`OK: ${events.length} 条事件 → js/data.js`);
  console.log(`   章节覆盖: ${[...new Set(events.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS[c].name).join(' / ')}`);
  console.log(`   坐标复用: ${Object.keys(coords).length} 条（demo 打样）`);
}

main();
