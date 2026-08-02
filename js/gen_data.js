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
  { id: 'c2',  no: '第二章',   name: '夏商',           note: '' },
  { id: 'c3',  no: '第三章',   name: '西周',           note: '' },
  { id: 'c4',  no: '第四章',   name: '春秋',           note: '前770年 至 前476年' },
  { id: 'c5',  no: '第五章',   name: '战国',           note: '' },
  { id: 'c6',  no: '第六章',   name: '秦',             note: '' },
  { id: 'c7',  no: '第七章',   name: '西汉',           note: '' },
  { id: 'c8',  no: '第八章',   name: '东汉',           note: '' },
  { id: 'c9',  no: '第九章',   name: '三国两晋南北朝', note: '' },
  { id: 'c10', no: '第十章',   name: '隋',             note: '' },
  { id: 'c11', no: '第十一章', name: '唐',             note: '' },
  { id: 'c12', no: '第十二章', name: '五代宋辽夏金',   note: '' },
  { id: 'c13', no: '第十三章', name: '元',             note: '' },
  { id: 'c14', no: '第十四章', name: '明',             note: '' },
  { id: 'c15', no: '第十五章', name: '清',             note: '' },
];

// dynasty（pilot 值）→ ch 索引
const DYN_TO_CH = {
  '原始社会': 0, '夏商': 1, '夏': 1, '商': 1, '西周': 2, '春秋': 3, '战国': 4, '秦': 5,
  '西汉': 6, '东汉': 7, '三国两晋南北朝': 8, '隋': 9, '唐': 10,
  '五代宋辽夏金': 11, '五代': 11, '元': 12, '元代': 12, '明': 13, '清': 14,
};

// ---- 试点 pilot 文件（位于 data/ 目录） ----
const PILOTS = [
  ['原始社会', 'data/原始社会_pilot_20260802.json'],
  ['夏商', 'data/夏商_pilot_20260802.json'],
  ['战国', 'data/战国_pilot_20260801.json'],
  ['元代', 'data/元代_pilot_20260802.json'],
];

// ---- 读 data/coords_demo.json（打样坐标缓存，F3 前临时；由 js/_extract_coords.js 从 demo2.html 提取） ----
function parseDemoCoords() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'coords_demo.json'), 'utf8'));
  } catch (e) {
    console.warn('coords_demo.json 读取失败（可先跑 js/_extract_coords.js）:', e.message);
    return {};
  }
}

// ---- 字段白名单与必填校验 ----
const REQ = ['title', 'year', 'yearMode', 'yearRange', 'dynasty', 'period', 'type', 'importance',
  'summary', 'cause', 'effect', 'examTip', 'people', 'location', 'tags', 'related', 'wikiSlug'];

function main() {
  const demoCoords = parseDemoCoords();
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
        era: '', eraSub: '',        // F1 起提示词要求 era 模式回填；旧试点兜底为空
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

  // COORDS：按 title 复用 demo 打样坐标
  const coords = {};
  events.forEach(e => { if (demoCoords[e.title]) coords[e.title] = demoCoords[e.title]; });

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
