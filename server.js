// server.js — 本地编辑服务（仅本地维护用，不部署）
// 用途：可视化编辑历史事件 → 写回 data/*_pilot_*.json → 自动重建 js/data.js + 校验
// 运行：node server.js  （或双击 启动.bat）；页面 http://localhost:3099
// 说明：file:// 双击 index.html 仍是只读展示；编辑数据必须走本服务
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT || 3099;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};
const REQ_FIELDS = ['title','year','yearMode','yearRange','dynasty','period','type','importance','summary','cause','effect','examTip','people','location','tags','related','wikiSlug','era','eraSub'];

// 与 js/gen_data.js 的 PILOTS 保持一致（新增章节录入后这里同步加行）
// 2026-08-05 统一命名：章数据一律「章名.json」/「第XX章.json」，去 _pilot_ 后缀；coords_demo 移 obsolete
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

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2e6) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('JSON 解析失败')); } });
    req.on('error', reject);
  });
}
function loadPilot(file) { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
function savePilot(file, data) { fs.writeFileSync(path.join(ROOT, file), JSON.stringify(data, null, 2) + '\n', 'utf8'); }

/* 校验事件（19 字段 + yearMode 规则），返回错误数组 */
function validateEvent(e) {
  const errs = [];
  for (const k of REQ_FIELDS) if (!(k in e)) errs.push('缺字段 ' + k);
  if (e.title === undefined || String(e.title).trim() === '') errs.push('title 不能为空');
  if (!['exact','approx','era','range'].includes(e.yearMode)) errs.push('yearMode 非法: ' + e.yearMode);
  if (e.yearMode === 'era' && e.year !== null) errs.push('era 模式 year 应为 null');
  if ((e.yearMode === 'exact' || e.yearMode === 'approx') && typeof e.year !== 'number') errs.push('exact/approx 需要数值 year');
  if (e.yearMode === 'range' && !Array.isArray(e.yearRange)) errs.push('range 需要 yearRange 数组');
  if (e.yearMode === 'range' && e.yearRange && e.yearRange[0] > 0 && e.yearRange[0] > e.yearRange[1]) errs.push('range 起>止');
  if (e.yearMode === 'era' && !e.era) errs.push('era 模式应填 era（时代段名）');
  if (e.month !== undefined && e.month !== null && (e.month < 1 || e.month > 12 || !Number.isInteger(e.month))) errs.push('month 应为 1-12 整数');
  for (const k of ['people','tags','related']) if (e[k] !== undefined && !Array.isArray(e[k])) errs.push(k + ' 应为数组');
  return errs;
}

/* 重建 data.js 并跑数据关卡。失败时若传入 backup（{file, raw}）则字节级还原 pilot 并重建 data.js，
   保证坏数据不落盘（B1 修复：原实现 check_data 失败时 pilot 已写坏、data.js 已用坏数据重建） */
function rebuild(backup) {
  try {
    execSync('node js/gen_data.js', { cwd: ROOT, stdio: 'pipe' });
    execSync('node js/check_data.js', { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    if (backup) {
      fs.writeFileSync(path.join(ROOT, backup.file), backup.raw, 'utf8');   // 字节级还原 pilot
      try { execSync('node js/gen_data.js', { cwd: ROOT, stdio: 'pipe' }); } catch (_) {}  // 干净数据重建 data.js
    }
    const msg = String(e.stdout || e.stderr || e.message || e).split('\n').slice(-8).join(' | ');  // check_data 错误走 stdout，须优先取
    throw new Error('数据关卡未通过，已回滚原数据：' + msg);
  }
}

/* 修改 pilot 前备份磁盘原始字节（回滚时字节级还原，避免重序列化改变格式） */
function backupOf(file) { return { file, raw: fs.readFileSync(path.join(ROOT, file), 'utf8') }; }

/* pilot 排序：按年份升序；era 事件（year=null）排末尾，避免 (a.year??0) 使其混入公元前后之间 */
function sortPilot(d) { return d.sort((a, b) => (a.year===null?Infinity:a.year) - (b.year===null?Infinity:b.year)); }

function findPilotByTitle(title) {
  for (const [tag, file] of PILOTS) {
    const d = loadPilot(file);
    const idx = d.findIndex(x => x.title === title);
    if (idx >= 0) return { tag, file, data: d, idx };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  /* ---- API ---- */
  if (p === '/api/events' && req.method === 'GET') {
    const all = [];
    for (const [, file] of PILOTS) all.push(...loadPilot(file));
    return json(res, 200, { ok: true, events: all, pilots: PILOTS.map(([tag, f]) => [tag, path.basename(f)]) });
  }
  if (p === '/api/event' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const e = body.event || {};
      const errs = validateEvent(e);
      if (errs.length) return json(res, 400, { ok: false, errors: errs });
      const tag = body.tag || e.dynasty;
      const hit = PILOTS.find(([t]) => t === tag);
      if (!hit) return json(res, 400, { ok: false, errors: ['章节「' + tag + '」暂无 pilot 文件，仅支持已有章节'] });
      const [, file] = hit;
      const d = loadPilot(file);
      if (d.some(x => x.title === e.title)) return json(res, 409, { ok: false, errors: ['已存在同名事件 ' + e.title] });
      const backup = backupOf(file);
      d.push(e); sortPilot(d);
      savePilot(file, d);
      rebuild(backup);
      return json(res, 200, { ok: true });
    } catch (err) { return json(res, 500, { ok: false, errors: [err.message] }); }
  }
  if (p === '/api/event' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const e = body.event || {};
      const errs = validateEvent(e);
      if (errs.length) return json(res, 400, { ok: false, errors: errs });
      const found = findPilotByTitle(body.oldTitle || e.title);
      if (!found) return json(res, 404, { ok: false, errors: ['未找到事件 ' + (body.oldTitle || e.title)] });
      // 若改了 title 且与另一条重名 → 拒绝
      if (e.title !== found.data[found.idx].title && found.data.some(x => x.title === e.title && x !== found.data[found.idx])) {
        return json(res, 409, { ok: false, errors: ['已存在同名事件 ' + e.title] });
      }
      found.data[found.idx] = e;
      const backup = backupOf(found.file);
      sortPilot(found.data);
      savePilot(found.file, found.data);
      rebuild(backup);
      return json(res, 200, { ok: true });
    } catch (err) { return json(res, 500, { ok: false, errors: [err.message] }); }
  }
  if (p === '/api/event' && req.method === 'DELETE') {
    try {
      const body = await readBody(req);
      const title = body.title;
      const found = findPilotByTitle(title);
      if (!found) return json(res, 404, { ok: false, errors: ['未找到事件 ' + title] });
      found.data.splice(found.idx, 1);
      const backup = backupOf(found.file);
      savePilot(found.file, found.data);
      rebuild(backup);
      return json(res, 200, { ok: true });
    } catch (err) { return json(res, 500, { ok: false, errors: [err.message] }); }
  }

  /* ---- 静态文件 ---- */
  /* 中文文件名（data/images/北京人.jpg 等）：pathname 是百分号编码，须 decodeURIComponent 才能读到文件（2026-08-05 抽屉头图试点发现） */
  let filePath = p === '/' ? '/index.html' : decodeURIComponent(p);
  const full = path.normalize(path.join(ROOT, filePath));
  if (!full.startsWith(ROOT)) return json(res, 403, { ok: false, errors: ['forbidden'] });
  fs.readFile(full, (err, buf) => {
    if (err) return json(res, 404, { ok: false, errors: ['not found: ' + p] });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('历史时间轴 · 本地编辑服务已启动');
  console.log('  页面: http://localhost:' + PORT);
  console.log('  数据写回: data/*_pilot_*.json → 自动重建 js/data.js');
  console.log('  （日常只读查看仍可双击 index.html）');
});
