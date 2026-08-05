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

// ---- 世界史 8 段（2026-08-05 老板定案：按标准时间边界硬切，事件按 year 落座不管教材章节）----
// 分段映射：world-ancient = 史前时代~中古封建时代（ch 0-3），world-modern = 近代早期~当代（ch 4-7）
const CHAPTERS_WORLD = [
  { id: 'w1', no: '第一段', name: '史前时代',     note: '前3500年以前' },
  { id: 'w2', no: '第二段', name: '早期文明',     note: '前3500 至 前1000' },
  { id: 'w3', no: '第三段', name: '古典文明',     note: '前1000 至 500' },
  { id: 'w4', no: '第四段', name: '中古封建时代', note: '500 至 1500' },
  { id: 'w5', no: '第五段', name: '近代早期',     note: '1500 至 1650' },
  { id: 'w6', no: '第六段', name: '革命与工业化', note: '1650 至 1900' },
  { id: 'w7', no: '第七段', name: '现代',         note: '1900 至 1945' },
  { id: 'w8', no: '第八段', name: '当代',         note: '1945 至 2012' },
];

// 世界史分段边界（整百/整数，老板定案）：year 硬切，不受教材章节影响
const WORLD_SEGS = [
  [-Infinity, -3500], [-3500, -1000], [-1000, 500], [500, 1500],
  [1500, 1650], [1650, 1900], [1900, 1945], [1945, Infinity],
];
// era 无 year（史前概念事件）：eraSub"距今X万"解析为负年；无时间锚默认史前段（-900万）
function worldSegYear(e){
  if(e.year != null) return e.year;
  const m=String(e.eraSub||'').match(/距今约?([\d.]+)\s*万/);
  if(m) return -Math.round(parseFloat(m[1])*10000);
  return -9000000;
}
function worldSeg(e){
  const y=worldSegYear(e);
  for(let i=0;i<WORLD_SEGS.length;i++){ if(y>=WORLD_SEGS[i][0] && y<WORLD_SEGS[i][1]) return i; }
  return 7;
}
// 地理大发现跨时代事件（老板定案 2026-08-05）：虽 <1500（按年硬切落中古段），但标志近代开端，强制归世界近现代史近代早期段（ch=4）
const WORLD_MOVE_TO_MODERN = new Set([
  '地理大发现与新航路开辟',   // 1492
  '哥伦布发现美洲',           // 1492
  '托得西拉斯条约',           // 1494 西葡瓜分新大陆
  '达·伽马开辟印度新航路',    // 1498
]);

// 事件年份 → 近代史段索引（严格按时间划分落座；1912 以清帝退位 2-12 为界）
// 仅用于 period 非标准段名的旧数据（晚清 7 章）；新数据（民国/共和国）走 PERIOD_TO_CH
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

// period（标准段名）→ 近代史段索引。新数据（民国/共和国）period 已是老板定稿标准段名，
// 按 period 落座可精确处理边界年份（1927.8 南昌起义/1937.7 七七事变/1945.9 抗战后/1949.10 建国后），
// 与教材章内 period 标注一致（晚清旧数据 period 不规范，仍走 modernSeg）
const PERIOD_TO_CH = {
  '外国武装侵略和国内农民战争': 0,
  '清朝自强运动及其失败': 1,
  '清末改革和清朝覆亡': 2,
  '北洋政府时期': 3,
  '土地革命战争时期': 4,
  '全民族抗日战争时期': 5,
  '解放战争时期': 6,
  '过渡时期（从新民主主义到社会主义）': 7,
  '全面建设社会主义时期': 8,
  '文化大革命时期': 9,
  '改革开放新时期': 10,
};

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
  ['原始社会', 'data/原始社会.json'],
  ['夏商', 'data/夏商.json'],
  ['西周', 'data/西周.json'],
  ['春秋', 'data/春秋.json'],
  ['战国', 'data/战国.json'],
  ['秦', 'data/秦.json'],
  ['西汉', 'data/西汉.json'],
  ['东汉', 'data/东汉.json'],
  ['三国两晋南北朝', 'data/三国两晋南北朝.json'],
  ['隋', 'data/隋.json'],
  ['唐', 'data/唐.json'],
  ['五代宋辽夏金', 'data/五代宋辽金西夏.json'],
  ['元代', 'data/元代.json'],
  ['明', 'data/明.json'],
  ['清', 'data/清前期.json'],
];

// ---- 读坐标来源（优先级：coords_resolved 历史坐标 > coords_modern 今址表 > worldCoords 世界史表；coords_demo 已并入 resolved 并移 obsolete，2026-08-05） ----
function loadJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch (e) { console.warn(file + ' 读取失败:', e.message); return {}; }
}
const histCoords = loadJson('data/coords_resolved.json');   // CHGIS 历史坐标（按 title）
const modernCoords = loadJson('data/coords_modern.json');   // 今址坐标表（按"今址"）
const worldCoords = loadJson('data/世界史坐标表.json'); // 世界史坐标（title→[lat,lng]，912 条 WGS84，2026-08-05 复制入 data/ 进版本库）

function todayName(loc) {
  const m = String(loc || '').match(/（(.+?)）/);
  return m ? m[1] : null;
}

// ---- 字段白名单与必填校验 ----
const REQ = ['title', 'year', 'yearMode', 'yearRange', 'dynasty', 'period', 'type', 'importance',
  'summary', 'cause', 'effect', 'examTip', 'people', 'location', 'tags', 'related', 'wikiSlug'];

// ---- 近代史 pilot 文件 ----
// 前 7 章：晚清（李侃《中国近代史》，period 录入值不规范，按年份 modernSeg 落座）
// 后 12 章：民国/共和国（王桧林《中国现代史》上/下册，period 已是标准段名，按 PERIOD_TO_CH 落座）
const PILOTS_MODERN = [
  ['第01章', 'data/第01章.json'],
  ['第02章', 'data/第02章.json'],
  ['第03章', 'data/第03章.json'],
  ['第04章', 'data/第04章.json'],
  ['第05章', 'data/第05章.json'],
  ['第06章', 'data/第06章.json'],
  ['第07章', 'data/第07章.json'],
  ['民国第01章', 'data/民国第01章.json', true],
  ['民国第02章', 'data/民国第02章.json', true],
  ['民国第03章', 'data/民国第03章.json', true],
  ['民国第04章', 'data/民国第04章.json', true],
  ['民国第05章', 'data/民国第05章.json', true],
  ['民国第06章', 'data/民国第06章.json', true],
  ['下册第01章', 'data/下册第01章.json', true],
  ['下册第02章', 'data/下册第02章.json', true],
  ['下册第03章', 'data/下册第03章.json', true],
  ['下册第04章', 'data/下册第04章.json', true],
  ['下册第05章', 'data/下册第05章.json', true],
  ['下册第06章', 'data/下册第06章.json', true],
];

// ---- 世界史产物数据（53 个 JSON 定稿，2026-08-05 复制入 data/世界史/ 进版本库——extract_workspace/ 被 gitignore 不入库） ----
const WORLD_DIR = 'data/世界史';

// 世界史排序键：有 year 用复合时间（年/月/日，无月排年首）；era 无 year 用 eraSub"距今X万"解析为负年，失败排末
function worldSortKey(e){
  if(e.year != null) return e.year*13*32 + (e.month||0)*32 + (e.day||0);
  const m=String(e.eraSub||'').match(/距今约?([\d.]+)\s*万/);
  if(m) return -Math.round(parseFloat(m[1])*10000);
  return 1e9;
}

function main() {
  const events = [];
  const eventsModern = [];
  const eventsWorld = [];
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

  // 近现代史：落座按年份（modernSeg）或 period 映射（periodKnown），period 覆盖为标准段名，dynasty 规范化
  for (const [tag, file, periodKnown] of PILOTS_MODERN) {
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
      let seg;
      if (periodKnown) {
        seg = PERIOD_TO_CH[it.period];
        if (seg === undefined) { errs.push(`[${tag} ${it.title}] period 非标准段名: ${it.period}`); return; }
      } else {
        seg = modernSeg(it);
      }
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

  // 世界史：53 文件直接读产物目录（定稿），period 标准段名映射落座（ch 0-7），dynasty 透传国家/文明/政权
  const worldDir = path.join(ROOT, WORLD_DIR);
  let worldFiles = [];
  try { worldFiles = fs.readdirSync(worldDir).filter(f => f.endsWith('.json')).sort(); }
  catch (e) { errs.push('世界史目录读取失败: ' + e.message); }
  for (const f of worldFiles) {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(worldDir, f), 'utf8')); }
    catch (e) { errs.push(`[世界史 ${f}] 读取失败: ${e.message}`); continue; }
    if (!Array.isArray(data)) { errs.push(`[世界史 ${f}] 不是数组`); continue; }
    data.forEach((it, i) => {
      const missing = REQ.filter(k => !(k in it));
      if (missing.length) { errs.push(`[世界史 ${f}#${i} ${it.title || '?'}] 缺字段 ${missing}`); return; }
      const ch = (WORLD_MOVE_TO_MODERN.has(it.title) ? 4 : worldSeg(it));
      if (ch === undefined) { errs.push(`[世界史 ${f} ${it.title}] 分段失败: ${it.period}`); return; }
      eventsWorld.push({
        title: it.title,
        year: it.year,
        month: it.month || null,
        day: it.day || null,
        yearMode: it.yearMode,
        yearRange: it.yearRange,
        era: it.era || '', eraSub: it.eraSub || '',
        ch,
        dynasty: it.dynasty,
        period: CHAPTERS_WORLD[ch].name,   /* 落座后统一写标准段名（不再用提取时的 period 名） */
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
  eventsWorld.sort((a, b) => worldSortKey(a) - worldSortKey(b));

  if (Object.keys(chMiss).length) errs.push(`未映射的 dynasty: ${JSON.stringify(chMiss)}`);
  if (errs.length) { console.error('ERRORS:\n - ' + errs.join('\n - ')); process.exit(1); }

  // COORDS：历史坐标 > 今址表 > 世界史坐标表 > demo 打样（近代史/世界史坐标均可在 coords_resolved 按 title）
  // COORDS_EXCLUDE：老板定案不上地图的事件（长跨度制度/思想文化类，今址兜底仍会命中故显式排除）
  const COORDS_EXCLUDE = new Set(['阿拉伯-伊斯兰文化', '启蒙运动']);
  const coords = {};
  [...events, ...eventsModern, ...eventsWorld].forEach(e => {
    if (COORDS_EXCLUDE.has(e.title)) return;
    if (histCoords[e.title]) { coords[e.title] = histCoords[e.title]; return; }
    const t = todayName(e.location);
    if (t && modernCoords[t]) { coords[e.title] = modernCoords[t]; return; }
    if (worldCoords[e.title]) { coords[e.title] = worldCoords[e.title]; return; }
  });

  const out = '// 自动生成，勿手改 — 由 js/gen_data.js 从 *_pilot_*.json 合并产出（F2 数据关卡前为试点基线）\n'
    + `const EVENTS=${JSON.stringify(events, null, 1)};\n\n`
    + `const CHAPTERS=${JSON.stringify(CHAPTERS, null, 1)};\n\n`
    + `const EVENTS_MODERN=${JSON.stringify(eventsModern, null, 1)};\n\n`
    + `const CHAPTERS_MODERN=${JSON.stringify(CHAPTERS_MODERN, null, 1)};\n\n`
    + `const EVENTS_WORLD=${JSON.stringify(eventsWorld, null, 1)};\n\n`
    + `const CHAPTERS_WORLD=${JSON.stringify(CHAPTERS_WORLD, null, 1)};\n\n`
    + `const COORDS=${JSON.stringify(coords, null, 1)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'data.js'), out, 'utf8');

  console.log(`OK: 古代史 ${events.length} 条 + 近代史 ${eventsModern.length} 条 + 世界史 ${eventsWorld.length} 条 → js/data.js`);
  console.log(`   古代史章节: ${[...new Set(events.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS[c].name).join(' / ')}`);
  console.log(`   近代史分段: ${[...new Set(eventsModern.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS_MODERN[c].name).join(' / ')}`);
  console.log(`   世界史分段: ${[...new Set(eventsWorld.map(e => e.ch))].sort((a, b) => a - b).map(c => CHAPTERS_WORLD[c].name).join(' / ')}`);
  console.log(`   坐标复用: ${Object.keys(coords).length} 条`);
}

main();
