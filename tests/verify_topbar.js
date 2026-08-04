// verify_topbar.js — 顶栏重构验收（交接文档 §10.6 史段切换）
// 依赖：本地 node server.js（端口 3099）
// 运行：NODE_PATH=$(npm root -g) node tests/verify_topbar.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  /* 截图不等待 CDN 字体（无头下偶发挂起），字体回退 SimSun 不影响布局验证。
     同时 abort 全部 jsdelivr CDN：CDN 间歇性挂起会阻塞页面解析（leaflet 挂起→data.js 不执行→EVENTS undef），
     核心回归只验证本地逻辑；地图初始化另由 verify_local.js（CDN 通时）覆盖 */
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort());
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fontsource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => { if (!/L is not defined/.test(e.message)) errors.push('PAGEERROR: ' + e.message); });

  await page.goto('http://localhost:3099', { waitUntil: 'commit', timeout: 15000 });
  await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok, detail: detail || '' }); console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? ' — ' + detail : '')); };

  /* 1. 顶栏四层结构（L1 站级 / L2 史段 / L3 视图 / L4 内容） */
  const h1 = await page.textContent('h1');
  check('L1 站级总名固定', h1.trim() === '考研历史时间轴', h1.trim());
  const titleTag = await page.title();
  const desc = await page.evaluate(() => document.querySelector('meta[name="description"]')?.content || '');
  check('SEO title / description', titleTag === '考研历史时间轴' && desc.includes('备考时间轴') && !/\d+\s*章|\d+\s*事|条|上线|规划/.test(desc), 'title=' + titleTag + ' | desc 无事件数/进度');
  const icon = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute('href') || '');
  check('favicon link', icon === 'favicon.svg', icon);

  const segBtns = await page.$$eval('#segRow .seg-btn', bs => bs.map(b => ({ t: b.textContent.trim(), on: b.classList.contains('on'), dis: b.disabled })));
  check('L2 四个史段按钮', segBtns.length === 4, JSON.stringify(segBtns.map(b => b.t)));
  check('L2 世界史段 disabled', segBtns[2].dis && segBtns[3].dis, 'world-ancient/world-modern 半透明禁用');
  check('L2 默认古代史 on', segBtns[0].on && !segBtns[1].on, '');

  const tabs = await page.$$eval('#viewTabs .tab', ts => ts.map(t => t.textContent.trim()));
  check('L3 视图 tab 三个', tabs.join('/') === '时间轴/地图/复习', tabs.join('/'));

  const hasBar = await page.$('#bar');
  check('L4 内容级筛选条存在', !!hasBar, '');

  /* 2. 古代史初始状态 */
  const bands0 = await page.$$eval('#main .band', bs => bs.length);
  const perLinks0 = await page.$$eval('#perGroup a.jump', as => as.length);
  check('古代史时间轴渲染（15 章带）', bands0 === 15, bands0 + ' bands');
  check('古代史分期链接 16 个', perLinks0 === 16, perLinks0 + ' links');
  const cnt0 = await page.textContent('#cnt');
  check('古代史计数', cnt0.includes('855'), cnt0.trim());

  /* 3. 切到近现代史 */
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(600);
  const segCls = await page.evaluate(() => document.body.className);
  check('modern 底色类 seg-modern', segCls.includes('seg-modern'), segCls);
  const pendText = await page.textContent('#main');
  check('modern 时间轴渲染（11 段 + 真实事件）', pendText.includes('黄爵滋上书') && pendText.includes('五四运动'), pendText.replace(/\s+/g, ' ').slice(0, 60));
  const perLinks1 = await page.$$eval('#perGroup a.jump', as => as.length);
  const perLabel1 = await page.textContent('#perGroup');
  check('modern 分期链接 12 个', perLinks1 === 12 && perLabel1.includes('外国武装侵略和国内农民战争'), perLabel1.trim().slice(0, 30));
  const cnt1 = await page.textContent('#cnt');
  check('modern 计数', cnt1.includes('866'), cnt1.trim());
  const modernBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('modern 底色为冷青蓝', modernBg === 'rgb(233, 237, 242)', modernBg);

  /* 4. 切回古代史（状态恢复） */
  await page.click('#segRow .seg-btn[data-seg="ancient"]');
  await page.waitForTimeout(600);
  const segCls2 = await page.evaluate(() => document.body.className);
  check('切回后无 seg-modern', !segCls2.includes('seg-modern'), segCls2 || '(空)');
  const bands1 = await page.$$eval('#main .band', bs => bs.length);
  const perLinks2 = await page.$$eval('#perGroup a.jump', as => as.length);
  check('切回后时间轴/分期恢复', bands1 === 15 && perLinks2 === 16, bands1 + ' bands / ' + perLinks2 + ' links');

  /* 4.3 ↑↓ 浮动按钮（老板反馈修复：bands 引用刷新 + scroll-margin 适配顶栏） */
  const topbarH = await page.evaluate(() => document.getElementById('topbar').offsetHeight);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 600); });
  await page.waitForTimeout(400);
  const upVisible = !(await page.evaluate(() => document.getElementById('toBand').hidden));
  const downVisible = !(await page.evaluate(() => document.getElementById('toNextBand').hidden));
  check('滚动后 ↑↓ 显示', upVisible && downVisible, '↑' + upVisible + ' ↓' + downVisible);
  await page.click('#toBand');
  await page.waitForTimeout(500);
  const upTop = await page.evaluate(() => document.querySelector('.band').getBoundingClientRect().top);
  check('点 ↑ 回当前章（band 在顶栏下方可见）', upTop >= topbarH - 2, 'band top=' + upTop.toFixed(0) + ' topbar=' + topbarH);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 600); });
  await page.waitForTimeout(400);
  await page.click('#toNextBand');
  await page.waitForTimeout(500);
  const downTop = await page.evaluate(() => document.querySelectorAll('.band')[1].getBoundingClientRect().top);
  check('点 ↓ 跳下一章（不被遮）', downTop >= topbarH - 2, 'band2 top=' + downTop.toFixed(0) + ' topbar=' + topbarH);
  /* 史段切换往返后 ↑↓ 仍工作（bands 引用已刷新） */
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(400);
  await page.click('#segRow .seg-btn[data-seg="ancient"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 600); });
  await page.waitForTimeout(400);
  const upAfterSeg = !(await page.evaluate(() => document.getElementById('toBand').hidden));
  const downAfterSeg = !(await page.evaluate(() => document.getElementById('toNextBand').hidden));
  check('史段切换往返后 ↑↓ 仍显示', upAfterSeg && downAfterSeg, '↑' + upAfterSeg + ' ↓' + downAfterSeg);

  /* 4.5 筛选面板浮层化：展开不撑高顶栏、不遮挡下面内容（老板要求，2026-08-04） */
  const tbH0 = await page.evaluate(() => document.getElementById('topbar').offsetHeight);
  await page.click('#filterToggle');
  await page.waitForTimeout(300);
  const tbH1 = await page.evaluate(() => document.getElementById('topbar').offsetHeight);
  check('筛选面板展开不撑高顶栏', tbH0 === tbH1, tbH0 + 'px → ' + tbH1 + 'px');

  /* 4.6 分期链接点击（事件委托重构后仍生效）：
     时间轴界面=跳锚点不筛（tl 上下文 ch Set 不变）；地图界面=按章多选过滤（map 上下文 ch Set）——浮层已由 4.5 展开 */
  await page.click('#perGroup a.jump:text-is("明")');
  const chTimeline = await page.evaluate(() => FILTERS['tl-ancient'].ch.size);
  check('时间轴界面点「明」=锚点跳转不筛选', chTimeline === 0, 'tl-ancient ch.size=' + chTimeline);
  await page.click('#viewTabs .tab[data-view="map"]');
  await page.waitForTimeout(400);
  await page.click('#perGroup a.jump:text-is("明")');
  const chMap = await page.evaluate(() => [...FILTERS['map-hist'].ch]);
  check('地图界面点「明」=按章过滤', chMap.join(',') === '13', 'map-hist ch=' + chMap.join(','));
  await page.click('#perGroup a.jump:text-is("全部")');
  const chAll = await page.evaluate(() => FILTERS['map-hist'].ch.size);
  check('地图界面点「全部」→清空', chAll === 0, 'map-hist ch.size=' + chAll);
  await page.click('#viewTabs .tab[data-view="timeline"]');

  /* 5. 地图 / 复习视图仍正常（CDN 已 abort，仅验证静态结构与视图切换；Leaflet 初始化由 verify_local.js 覆盖） */
  await page.click('#viewTabs .tab[data-view="map"]');
  await page.waitForTimeout(400);
  const mapViewVisible = await page.evaluate(() => !document.getElementById('view-map').hidden && !!document.getElementById('map'));
  check('地图视图切换正常（容器存在）', !!mapViewVisible, '');
  const rangeOpts = await page.$$eval('#rangeSel option', os => os.map(o => o.value));
  const rangeSelVal = await page.$eval('#rangeSel', s => s.value);
  check('地图下拉三态（pre/hist/modern）', rangeOpts.join('/') === 'pre/hist/modern' && rangeSelVal === 'hist', rangeOpts.join('/') + ' sel=' + rangeSelVal);
  await page.click('#viewTabs .tab[data-view="review"]');
  await page.waitForTimeout(800);
  const rvVisible = await page.evaluate(() => !document.getElementById('rvSetup').hidden);
  check('复习视图设置可见', rvVisible, '');
  await page.click('#viewTabs .tab[data-view="timeline"]');

  /* 6. 截图（桌面 + 移动端）——CDN 字体可能慢，放宽超时并先等 fonts.ready */
  fs.mkdirSync('tmp', { recursive: true });
  await page.evaluate(() => document.fonts.ready.catch(() => {})).catch(() => {});
  await page.screenshot({ path: 'tmp/topbar_ancient.png', fullPage: false, timeout: 60000 });
  await page.click('#segRow .seg-btn[data-seg="modern"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tmp/topbar_modern.png', fullPage: false, timeout: 60000 });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.route('**/@fontsource/**', r => r.abort());
  await mobile.goto('http://localhost:3099', { waitUntil: 'commit' });
  await mobile.waitForFunction(() => typeof EVENTS !== 'undefined', { timeout: 20000 }).catch(() => {});
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: 'tmp/topbar_mobile.png', fullPage: false, timeout: 60000 });
  await mobile.close();

  /* 7. JS 报错 */
  check('无 JS 报错', errors.length === 0, errors.join(' | ').slice(0, 200));

  await browser.close();
  const fails = results.filter(r => !r.ok);
  console.log('\n===== ' + (fails.length === 0 ? '全部通过 ✅' : '失败 ' + fails.length + ' 项 ❌') + ' =====');
  process.exit(fails.length === 0 ? 0 : 1);
})();
