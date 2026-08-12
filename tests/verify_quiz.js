// tests/verify_quiz.js — 题型专练（P1 判断题）验收（2026-08-12）
// 用法: NODE_PATH="$(npm root -g)" node tests/verify_quiz.js
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 清空 quiz 错题记录
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ht-review-qz-'));
    keys.forEach(k => localStorage.removeItem(k));
  });

  const results = [];
  const check = (name, cond, extra = '') => results.push({ name, ok: !!cond, extra });

  // 0. 纯函数单元断言：genJudgment 同世纪配对
  const unit = await page.evaluate(() => {
    const pool = EVENTS.filter(e => e.year != null && e.type === '军事');
    const qs = genJudgment(pool, 20);
    return {
      n: qs.length,
      sameCentury: qs.every(q => {
        const a = EVENTS.find(e => e.title === q.options[0].text);
        const b = EVENTS.find(e => e.title === q.options[1].text);
        if (!a || !b) return false;
        const ka = quizSortKey(a), kb = quizSortKey(b);
        return ka != null && kb != null && centuryOf(ka) === centuryOf(kb) && ka !== kb;
      }),
      answerValid: qs.every(q => q.answer === 0 || q.answer === 1),
      hasHash: qs.every(q => !!q.hash)
    };
  });
  check('genJudgment 生成 > 0', unit.n > 0, 'n=' + unit.n);
  check('题目均同世纪且不同年', unit.sameCentury);
  check('答案合法', unit.answerValid);
  check('题干 hash 齐全', unit.hasHash);

  // 1. 进入复习 → quiz 模式
  await page.click('.tab[data-view="review"]');
  await page.waitForTimeout(300);
  await page.click('#rvModes .rv-mode-btn[data-mode="quiz"]');
  await page.waitForTimeout(200);
  check('quiz 题型区可见', await page.locator('#rvQuizSec:visible').count() === 1);
  check('漫游范围区隐藏', await page.locator('#rvRoamScope:visible').count() === 0);

  // 2. 题数=2，开始 → 判断题卡片
  await page.fill('#rvNum', '2');
  await page.waitForTimeout(150);
  await page.click('#rvStart');
  await page.waitForTimeout(400);
  check('判断题卡片显示', await page.locator('#rvQuiz:visible').count() === 1);
  check('题干「更早」', (await page.locator('.qz-q').textContent()).includes('更早'));
  check('两选项', await page.locator('.qz-opt').count() === 2);
  check('翻牌卡隐藏', await page.locator('#rvCard:visible').count() === 0);
  check('进度显示判断题', (await page.locator('#rvProg').textContent()).includes('判断题'));

  // 3. 第一题答对
  const ans1 = await page.evaluate(() => rvState.cur.quiz.answer);
  await page.click('.qz-opt >> nth=' + ans1);
  await page.waitForTimeout(200);
  check('答对显示 ✓', (await page.locator('.qz-res').textContent()).includes('✓'));
  check('反馈含时间', (await page.locator('.qz-res').textContent()).includes('早于'));
  check('下一题按钮', await page.locator('.qz-next').count() === 1);

  // 4. 下一题 → 答错
  await page.click('.qz-next');
  await page.waitForTimeout(300);
  const ans2 = await page.evaluate(() => rvState.cur.quiz.answer);
  const wrong2 = ans2 === 0 ? 1 : 0;
  await page.click('.qz-opt >> nth=' + wrong2);
  await page.waitForTimeout(200);
  check('答错显示 ✗', (await page.locator('.qz-res').textContent()).includes('✗'));
  const qzRec = await page.evaluate(() => {
    const ks = Object.keys(localStorage).filter(x => x.startsWith('ht-review-qz-'));
    return ks.map(k => localStorage.getItem(k));
  });
  check('错题已记录 fail', qzRec.includes('fail'), qzRec.join(','));

  // 5. 错题重练：答错的题进第 2 轮 → 答对 → 完成
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('进入第 2 轮重练', (await page.locator('#rvFails').textContent()).includes('第 2 轮'));
  check('重练题仍显示', await page.locator('#rvQuiz:visible').count() === 1);
  const ans3 = await page.evaluate(() => rvState.cur.quiz.answer);
  await page.click('.qz-opt >> nth=' + ans3);
  await page.waitForTimeout(200);
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('本轮完成页', await page.locator('#rvDone:visible').count() === 1);
  check('统计含记住 2', (await page.locator('#rvDoneStat').textContent()).includes('记住 2'));

  // 6. 再来一轮 → 返回设置
  await page.click('#rvAgain');
  await page.waitForTimeout(200);
  check('返回设置界面', await page.locator('#rvSetup:visible').count() === 1);

  let pass = 0, fail = 0;
  for (const r of results) { r.ok ? pass++ : fail++; console.log((r.ok ? 'PASS' : 'FAIL') + '\t' + r.name + (r.extra ? '\t(' + r.extra + ')' : '')); }
  console.log('----');
  console.log('通过 ' + pass + ' / ' + (pass + fail) + (errors.length ? '；JS 错误：\n' + errors.join('\n') : ''));
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
