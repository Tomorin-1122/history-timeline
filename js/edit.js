/* edit.js — 本地可视化编辑（仅本地服务 http:// 下启用，file:// 只读）
   功能：新增 / 编辑 / 删除历史事件 → 写回 data/*_pilot_*.json（经 server.js API） */
'use strict';

(function () {
  const isLocal = location.protocol === 'http:';
  const editToggle = document.getElementById('editToggle');
  if (!editToggle) return;
  if (!isLocal) return;                      /* file:// 直开：编辑 UI 保持隐藏 */

  let editMode = false;
  let curIdx = -1;                            /* 当前抽屉事件索引 */
  let curPilots = [];                         /* [{tag,file}] 已有章节 */

  editToggle.hidden = false;

  /* ---- 打开抽屉时记录当前事件（包装 openDrawer） ---- */
  const _open = openDrawer;
  openDrawer = function (idx) {
    curIdx = idx;
    _open(idx);
    document.getElementById('drawerEdit').hidden = !editMode;
  };

  /* ---- 编辑模式开关 ---- */
  editToggle.addEventListener('click', () => {
    editMode = !editMode;
    editToggle.classList.toggle('on', editMode);
    editToggle.textContent = editMode ? '完成编辑' : '编辑';
    document.getElementById('addEvent').hidden = !editMode;
    document.getElementById('drawerEdit').hidden = !(editMode && curIdx >= 0);
  });

  /* ---- modal ---- */
  const modal = document.getElementById('editModal');
  const mTitle = document.getElementById('mTitle');
  function closeModal() { modal.hidden = true; }
  document.getElementById('mCancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  /* ---- 表单收集/填充 ---- */
  const F = id => document.getElementById(id);
  function evFromForm() {
    const splitArr = v => String(v || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const e = {
      title: F('fTitle').value.trim(),
      yearMode: F('fYearMode').value,
      year: null, yearRange: null, era: F('fEra').value.trim(), eraSub: F('fEraSub').value.trim(),
      dynasty: F('fDynasty').value.trim(), period: F('fPeriod').value.trim(), type: F('fType').value.trim(),
      importance: Number(F('fImp').value),
      summary: F('fSum').value.trim(), cause: F('fCause').value.trim(), effect: F('fEffect').value.trim(),
      examTip: F('fTip').value.trim(),
      people: splitArr(F('fPpl').value), location: F('fLoc').value.trim(),
      tags: splitArr(F('fTags').value), related: splitArr(F('fRel').value), wikiSlug: F('fSlug').value.trim() || F('fTitle').value.trim(),
    };
    if (e.yearMode === 'exact' || e.yearMode === 'approx') {
      const y = Number(F('fYear').value);
      if (!isNaN(y)) e.year = y;
    } else if (e.yearMode === 'range') {
      const r = F('fYearRange').value.split(/[,，]/).map(Number);
      if (r.length === 2 && !isNaN(r[0]) && !isNaN(r[1])) { e.year = r[0]; e.yearRange = [r[0], r[1]]; }
    }
    return e;
  }
  function fillForm(e, tag) {
    F('fTitle').value = e.title || '';
    F('fYearMode').value = e.yearMode || 'exact';
    F('fYear').value = (e.yearMode === 'exact' || e.yearMode === 'approx') && e.year != null ? e.year : '';
    F('fYearRange').value = e.yearRange ? e.yearRange.join(',') : '';
    F('fEra').value = e.era || ''; F('fEraSub').value = e.eraSub || '';
    F('fDynasty').value = e.dynasty || ''; F('fPeriod').value = e.period || ''; F('fType').value = e.type || '';
    F('fImp').value = e.importance || 1;
    F('fSum').value = e.summary || ''; F('fCause').value = e.cause || ''; F('fEffect').value = e.effect || ''; F('fTip').value = e.examTip || '';
    F('fPpl').value = (e.people || []).join('、'); F('fLoc').value = e.location || '';
    F('fTags').value = (e.tags || []).join('、'); F('fRel').value = (e.related || []).join('、'); F('fSlug').value = e.wikiSlug || '';
  }
  /* yearMode 切换：era 高亮提示 era/eraSub，range 显示 yearRange，exact/approx 显示 year */
  F('fYearMode').addEventListener('change', () => {
    const m = F('fYearMode').value;
    F('fYear').disabled = !(m === 'exact' || m === 'approx');
    F('fYearRange').disabled = m !== 'range';
    F('fEra').disabled = m !== 'era';
    F('fEraSub').disabled = m !== 'era';
  });

  /* ---- 新增 ---- */
  document.getElementById('addEvent').addEventListener('click', async () => {
    mTitle.textContent = '新增事件';
    fillForm({ yearMode: 'exact', importance: 2 }, '');
    const sel = F('fTag');
    sel.innerHTML = '';
    for (const { tag, file } of curPilots) {   /* curPilots 元素是对象，须用对象解构（数组解构会崩） */
      const o = document.createElement('option'); o.value = tag; o.textContent = tag; sel.appendChild(o);
    }
    sel.parentElement.style.display = '';
    F('fTitle').disabled = false;
    modal.hidden = false;
  });

  /* ---- 编辑 ---- */
  document.getElementById('dEdit').addEventListener('click', () => {
    if (curIdx < 0) return;
    const e = EVENTS[curIdx];
    mTitle.textContent = '编辑事件：' + e.title;
    fillForm(e);
    const sel = F('fTag'); sel.parentElement.style.display = 'none';  /* 编辑不改章节 */
    F('fTitle').disabled = true;                                      /* 改 title 走"另存"复杂，先锁定 */
    modal.hidden = false;
  });

  /* ---- 删除 ---- */
  document.getElementById('dDel').addEventListener('click', async () => {
    if (curIdx < 0) return;
    const e = EVENTS[curIdx];
    if (!confirm('确认删除事件「' + e.title + '」？将写入数据源并重建，git 可回退。')) return;
    const r = await fetch('/api/event', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: e.title }) });
    const j = await r.json();
    if (j.ok) location.reload();
    else alert('删除失败：' + (j.errors || []).join('\n'));
  });

  /* ---- 保存 ---- */
  document.getElementById('mSave').addEventListener('click', async () => {
    const e = evFromForm();
    const isNew = mTitle.textContent.startsWith('新增');
    const url = '/api/event';
    const method = isNew ? 'POST' : 'PUT';
    const body = isNew ? { event: e, tag: F('fTag').value } : { event: e, oldTitle: EVENTS[curIdx].title };
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.ok) { location.reload(); }
    else { alert('保存失败：\n' + (j.errors || []).join('\n')); }
  });

  /* ---- 初始化：拉取章节清单（pilot 列表） ---- */
  (async () => {
    try {
      const r = await fetch('/api/events');
      const j = await r.json();
      curPilots = (j.pilots || []).map(([tag, file]) => ({ tag, file }));
    } catch (e) { /* 非本地服务时保持只读 */ }
  })();
})();
