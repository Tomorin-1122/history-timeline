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

  // 0b. 选择题甲种单元断言
  const unit2 = await page.evaluate(() => {
    const pool = EVENTS.filter(e => e.year != null && e.importance === 3);
    const qs = genChoiceA(pool, 20);
    return {
      n: qs.length,
      four: qs.every(q => q.options.length === 4),
      unique: qs.every(q => new Set(q.options.map(o => o.text)).size === 4),
      answerValid: qs.every(q => q.answer >= 0 && q.answer < 4),
      detail: qs.every(q => !!q.detail)
    };
  });
  check('genChoiceA 生成 > 0', unit2.n > 0, 'n=' + unit2.n);
  check('选项恒 4 个', unit2.four);
  check('选项互不重复', unit2.unique);
  check('答案合法', unit2.answerValid);
  check('含完整时间 detail', unit2.detail);
  const sample = await page.evaluate(() => {
    const pool = EVENTS.filter(e => e.year != null);
    const q = genChoiceA(pool, 1)[0];
    const title = q.q.replace(/^「/, '').split('」')[0];
    const ev = EVENTS.find(e => e.title === title);
    return { text: q.options[q.answer].text, bucket: timeBucket(ev) ? timeBucket(ev).text : null };
  });
  check('正确项 = 真实时间桶', sample.text === sample.bucket, sample.text + ' vs ' + sample.bucket);

  // 0c. 排序题单元断言
  const unit3 = await page.evaluate(() => {
    const qs = genSorting(10);
    return {
      n: qs.length,
      items: qs.every(q => q.items.length >= 3 && q.items.length === q.order.length),
      orderMatches: qs.every(q => q.order.every(t => q.items.some(it => it.text === t))),   /* order 与 items 同集 */
      hasTime: qs.every(q => q.items.every(it => it.time !== ""))
    };
  });
  check('genSorting 生成 > 0', unit3.n > 0, 'n=' + unit3.n);
  check('链长 ≥3 且 order 等长', unit3.items);
  check('order 与 items 同集', unit3.orderMatches);
  check('事件均带时间展示', unit3.hasTime);

  // 0d. 多选题（乙种）单元断言：正确项在该时段、错误项不在、选项 5-8
  const unit4 = await page.evaluate(() => {
    const qs = genChoiceB(10);
    const all = [...EVENTS, ...EVENTS_MODERN, ...EVENTS_WORLD];
    return {
      n: qs.length,
      ansCnt: qs.every(q => q.answer.length >= 2 && q.answer.length <= 4),
      optCnt: qs.every(q => q.options.length >= 5 && q.options.length <= 8),
      correctInBucket: qs.every(q => q.answer.every(i => {
        const ev = all.find(e => e.title === q.options[i].text);
        const b = ev ? timeBucket(ev) : null;
        return b && b.text === q.detail;
      })),
      wrongOutOfBucket: qs.every(q => q.options.every((o, i) => {
        if (q.answer.includes(i)) return true;
        const ev = all.find(e => e.title === o.text);
        const b = ev ? timeBucket(ev) : null;
        return b && b.text !== q.detail;
      }))
    };
  });
  check('genChoiceB 生成 > 0', unit4.n > 0, 'n=' + unit4.n);
  check('正确项 2-4 个', unit4.ansCnt);
  check('选项 5-8 个', unit4.optCnt);
  check('正确项均在该时段', unit4.correctInBucket);
  check('错误项均不在该时段', unit4.wrongOutOfBucket);

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

  // 7. 选择题甲种 UI：切题型 → 4 选项 → 判题 → 完成
  await page.click('#rvQuizTypes button[data-qz="choiceA"]');
  await page.waitForTimeout(150);
  await page.fill('#rvNum', '1');
  await page.waitForTimeout(150);
  await page.click('#rvStart');
  await page.waitForTimeout(400);
  check('选择题卡片 4 选项', await page.locator('.qz-opt').count() === 4);
  check('选择题题干「时间段」', (await page.locator('.qz-q').textContent()).includes('哪个时间段'));
  check('进度显示选择题', (await page.locator('#rvProg').textContent()).includes('选择题'));
  // 第 1 题答错
  const ansC = await page.evaluate(() => rvState.cur.quiz.answer);
  const wrongC = ansC === 0 ? 1 : 0;
  await page.click('.qz-opt >> nth=' + wrongC);
  await page.waitForTimeout(200);
  check('选择题答错反馈', (await page.locator('.qz-res').textContent()).includes('✗'));
  check('反馈含时间桶', ((await page.locator('.qz-res').textContent()).includes('世纪')) || ((await page.locator('.qz-res').textContent()).includes('年代')));
  // 下一题 → 第 2 轮重练
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('选择题进入第 2 轮', (await page.locator('#rvFails').textContent()).includes('第 2 轮'));
  // 第 2 轮答对
  const ansC2 = await page.evaluate(() => rvState.cur.quiz.answer);
  await page.click('.qz-opt >> nth=' + ansC2);
  await page.waitForTimeout(200);
  check('选择题答对反馈', (await page.locator('.qz-res').textContent()).includes('✓'));
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('选择题完成页', await page.locator('#rvDone:visible').count() === 1);

  // 8. 排序题 UI：点选填序 → 填满自动判题 → 完成
  await page.click('#rvAgain');
  await page.waitForTimeout(200);
  await page.click('#rvQuizTypes button[data-qz="sort"]');
  await page.waitForTimeout(150);
  await page.fill('#rvNum', '1');
  await page.waitForTimeout(150);
  await page.click('#rvStart');
  await page.waitForTimeout(400);
  check('排序题卡片渲染', await page.locator('.qz-sort-item').count() >= 3);
  check('排序题题干「排列」', (await page.locator('.qz-q').textContent()).includes('排列'));
  check('进度显示排序题', (await page.locator('#rvProg').textContent()).includes('排序题'));
  const seq = await page.evaluate(() => rvState.cur.quiz.order.map(t => rvState.cur.quiz.items.findIndex(it => it.text === t)));
  for (const k of seq) await page.click('.qz-sort-item >> nth=' + k);
  await page.waitForTimeout(200);
  check('排序答对自动判题', (await page.locator('.qz-res').textContent()).includes('✓'));
  check('反馈含正确顺序', (await page.locator('.qz-res').textContent()).includes('正确顺序'));
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('排序题完成页', await page.locator('#rvDone:visible').count() === 1);

  // 9. 多选题（乙种）UI：勾选 → 提交 → 全对/漏选判错 → 重练完成
  await page.click('#rvAgain');
  await page.waitForTimeout(200);
  await page.click('#rvQuizTypes button[data-qz="choiceB"]');
  await page.waitForTimeout(150);
  await page.fill('#rvNum', '1');
  await page.waitForTimeout(150);
  await page.click('#rvStart');
  await page.waitForTimeout(400);
  check('多选题卡片渲染', await page.locator('.qz-opt').count() >= 5);
  check('多选题题干「哪些事件」', (await page.locator('.qz-q').textContent()).includes('哪些事件'));
  check('提交按钮', await page.locator('.qz-submit').count() === 1);
  check('进度显示多选题', (await page.locator('#rvProg').textContent()).includes('多选题'));
  const ansB = await page.evaluate(() => rvState.cur.quiz.answer);
  await page.click('.qz-opt >> nth=' + ansB[0]);   /* 只选 1 个正确项 → 漏选判错 */
  await page.click('.qz-submit');
  await page.waitForTimeout(200);
  check('多选题漏选判错', (await page.locator('.qz-res').textContent()).includes('✗'));
  check('反馈列正确事件', (await page.locator('.qz-res').textContent()).includes('发生'));
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('多选题进入第 2 轮', (await page.locator('#rvFails').textContent()).includes('第 2 轮'));
  const ansB2 = await page.evaluate(() => rvState.cur.quiz.answer);
  for (const i of ansB2) await page.click('.qz-opt >> nth=' + i);
  await page.click('.qz-submit');
  await page.waitForTimeout(200);
  check('多选题全对反馈', (await page.locator('.qz-res').textContent()).includes('✓'));
  await page.click('.qz-next');
  await page.waitForTimeout(400);
  check('多选题完成页', await page.locator('#rvDone:visible').count() === 1);

  let pass = 0, fail = 0;
  for (const r of results) { r.ok ? pass++ : fail++; console.log((r.ok ? 'PASS' : 'FAIL') + '\t' + r.name + (r.extra ? '\t(' + r.extra + ')' : '')); }
  console.log('----');
  console.log('通过 ' + pass + ' / ' + (pass + fail) + (errors.length ? '；JS 错误：\n' + errors.join('\n') : ''));
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
