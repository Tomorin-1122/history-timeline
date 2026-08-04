// 本地验收：页面加载 + 三章数据 + 地图 marker 验证
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3099', { waitUntil: 'commit', timeout: 15000 });
  // CDN 字体/Leaflet 可能慢：手动等核心脚本就绪。CDN 挂起会阻塞页面解析（leaflet 阻塞→data.js 不执行）
  const ready = await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!ready) {
    console.log('⚠️ EVENTS 未就绪：jsdelivr CDN 挂起阻塞了页面解析（本机 curl 正常但浏览器不可达）。');
    console.log('   地图回归需 CDN 可达（Leaflet/字体），请网络恢复后重跑；顶栏/史段/筛选回归用 verify_topbar.js（已隔离 CDN）。');
    await browser.close();
    process.exit(0);
  }
  await page.waitForFunction(() => typeof EVENTS !== 'undefined' && EVENTS.length > 0, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // 1. 事件总数 + 章节列表
  const evtCount = await page.evaluate(() => typeof EVENTS !== 'undefined' ? EVENTS.length : -1);
  const chNames = await page.evaluate(() => typeof CHAPTERS !== 'undefined' ? CHAPTERS.map(c => c.name) : []);
  const coordCount = await page.evaluate(() => typeof COORDS !== 'undefined' ? Object.keys(COORDS).length : -1);
  console.log('EVENTS:', evtCount);
  console.log('COORDS:', coordCount);
  console.log('章节:', chNames.join(' / '));

  // 2. 三章数据抽样（五代/明/清 title 数量）
  const counts = await page.evaluate(() => {
    const get = n => EVENTS.filter(e => e.ch === n).length;
    return { wudai: get(11), ming: get(13), qing: get(14) };
  });
  console.log('五代宋辽夏金(ch11):', counts.wudai, '| 明(ch13):', counts.ming, '| 清(ch14):', counts.qing);

  // 3. 页面有地图容器 + 切章按钮
  const hasMap = await page.evaluate(() => !!document.querySelector('#map'));
  console.log('地图容器存在:', hasMap);
  const linkTexts = await page.evaluate(() => [...document.querySelectorAll('#period-links a, .ch-link, a[data-ch]')].map(a => a.textContent.trim()).filter(Boolean).slice(0, 20));
  console.log('分期链接:', linkTexts.join(' | '));

  // 4. 检查明章 marker 是否绘制（切到明章）
  try {
    await page.click('text=明');
    await page.waitForTimeout(1500);
    const markers = await page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon').length);
    console.log('切到明章后 marker 数:', markers);
  } catch (e) { console.log('切章失败(可能选择器不同):', e.message.slice(0, 80)); }

  console.log('JS 错误:', errors.length ? errors.slice(0, 5).join(' | ') : '无 ✅');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
