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

// ---- 近现代史 11 段（period 最终命名定稿 2026-08-04，索引即近代史 ch）----
const CHAPTERS_MODERN = [
  { id: 'm1',  no: '第一段',   name: '外国武装侵略和国内农民战争',     note: '1840-1864' },
  { id: 'm2',  no: '第二段',   name: '清朝自强运动及其失败',           note: '1865-1895' },
  { id: 'm3',  no: '第三段',   name: '清末改革和清朝覆亡',             note: '1896-1912' },
  { id: 'm4',  no: '第四段',   name: '北洋政府时期',                   note: '1912-1927' },
  { id: 'm5',  no: '第五段',   name: '土地革命战争时期',               note: '1927-1937' },
  { id: 'm6',  no: '第六段',   name: '全民族抗日战争时期',             note: '1937-1945' },
  { id: 'm7',  no: '第七段',   name: '解放战争时期',                   note: '1946-1949' },
  { id: 'm8',  no: '第八段',   name: '过渡时期（从新民主主义到社会主义）', note: '1949-1956' },
  { id: 'm9',  no: '第九段',   name: '全面建设社会主义时期',           note: '1956-1966' },
  { id: 'm10', no: '第十段',   name: '文化大革命时期',                 note: '1966-1976' },
  { id: 'm11', no: '第十一段', name: '改革开放新时期',                 note: '1976-2012' },
];

// 事件年份 → 近代史段索引（严格按时间划分落座；1912 以清帝退位 2-12 为界）
function modernSeg(e) {
  const y = e.year;
  if (y <= 1864) return 0;
  if (y <= 1895) return 1;
  if (y < 1912) return 2;
  if (y === 1912) {
    const m = e.month || 0, d = e.day || 0;
    return (m < 2 || (m === 2 && d <= 12)) ? 2 : 3;   /* 清帝退位(1912-2-12)前归清末段 */
  }
  if (y <= 1927) return 3;
  if (y <= 1937) return 4;
  if (y <= 1945) return 5;
  if (y <= 1949) return 6;
  if (y <= 1956) return 7;
  if (y <= 1966) return 8;
  if (y <= 1976) return 9;
  return 10;
}

// 近代史事件排序键：year*13*32 + (month||0)*32 + (day||0)
// 同年无 month → 排该年开头；同月无 day → 排该月开头；有 day 按日期先后（显示仍只到月，日期仅排序）
function modernSortKey(e) {
  return e.year * 13 * 32 + (e.month || 0) * 32 + (e.day || 0);
}

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

// ---- 近代史 pilot 文件（第01-07章，period 落座按年份） ----
const PILOTS_MODERN = [
  ['第01章', 'data/第01章.json'],
  ['第02章', 'data/第02章.json'],
  ['第03章', 'data/第03章.json'],
  ['第04章', 'data/第04章.json'],
  ['第05章', 'data/第05章.json'],
  ['第06章', 'data/06章.json'],
  ['第07章', 'data/07章.json'],
];

function main() {
  const events = [];
  const eventsModern = [];
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
        month: it.month || null,          /* 同年排序用：1-12，无则 null（排在有月份事件后） */
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

  // 近现代史：落座按年份（modernSeg），period 覆盖为标准段名，dynasty 规范化（民国初年→民国）
  for (const [tag, file] of PILOTS_MODERN) {
    const p = path.join(ROOT, file);
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { errs.push(`[${tag}] 读取失败: ${e.message}`); continue; }
    if (!Array.isArray(data)) { errs.push(`[${tag}] 不是数组`); continue; }
    data.forEach((it, i) => {
      const missing = REQ.filter(k => !(k in it));
      if (missing.length) { errs.push(`[${tag}#${i} ${it.title || '?'}] 缺字段 ${missing}`); return; }
      if (it.year == null && !(Array.isArray(it.yearRange) && it.yearRange.length)) {
        errs.push(`[${tag} ${it.title}] 无年份且无 yearRange，近代史必须可落座`); return;
      }
      const seg = modernSeg(it);
      eventsModern.push({
        title: it.title,
        year: it.year,
        month: it.month || null,
        day: it.day || null,              /* 近代史 21 字段：日（同年同日排序） */
        yearMode: it.yearMode,
        yearRange: it.yearRange,
        era: it.era || '', eraSub: it.eraSub || '',
        ch: seg,
        dynasty: it.dynasty === '民国初年' ? '民国' : it.dynasty,
        period: CHAPTERS_MODERN[seg].name,   /* 落座后统一为标准段名 */
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
  eventsModern.sort((a, b) => modernSortKey(a) - modernSortKey(b));  /* 全库按复合时间排（落座后段内仍有序） */

  if (Object.keys(chMiss).length) errs.push(`未映射的 dynasty: ${JSON.stringify(chMiss)}`);
  if (errs.length) { console.error('ERRORS:\n - ' + errs.join('\n - ')); process.exit(1); }

  // COORDS：历史坐标 > 今址表 > demo 打样（近代史坐标已在 coords_resolved 按 title）
  const coords = {};
  [...events, ...eventsModern].forEach(e => {
    if (histCoords[e.title]) { coords[e.title] = histCoords[e.title]; return; }
    const t = todayName(e.location);
    if (t && modernCoords[t]) { coords[e.title] = modernCoords[t]; return; }
    if (demoCoords[e.title]) coords[e.title] = demoCoords[e.title];
  });

  const out = '// 自动生成，勿手改 — 由 js/gen_data.js 从 *_pilot_*.json 合并产出（F2 数据关卡前为试点基线）\n'
    + `const EVENTS=${JSON.stringify(events, null, 1)};\n\n`
    + `const CHAPTERS=${JSON.stringify(CHAPTERS, null, 1)};\n\n`
    + `const EVENTS_MODERN=${JSON.stringify(eventsModern, null, 1)};\n\n`
    + `const CHAPTERS_MODERN=${JSON.stringify(CHAPTERS_MODERN, null, 1)};\n\n`
    + `const COORDS=${JSON.stringify(coords, null, 1)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'data.js'), out, 'utf8');

  console.log(`OK: 古代史 ${events.length} 条 + 近代史 ${eventsModern.length} 条 → js/data.js`);
  console.log(`   古代史章节: ${[...new Set(events.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS[c].name).join(' / ')}`);
  console.log(`   近代史分段: ${[...new Set(eventsModern.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS_MODERN[c].name).join(' / ')}`);
  console.log(`   坐标复用: ${Object.keys(coords).length} 条`);
}

main();
