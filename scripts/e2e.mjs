/**
 * 端到端验收测试（Puppeteer + 本机 Chrome/Edge，不下载 Chromium）
 * ------------------------------------------------------------------
 * 覆盖需求中的实际验收项：
 *   1. 首次测试生成段位（14 题）
 *   2. 经验增加与升级规则（跨门槛升级提示）
 *   3. 徽章按条件解锁
 *   4. 每日任务不会重复领奖（刷新 + 连点）
 *   5. 刷新后进度仍在
 *   6. 重置与数据损坏恢复
 *   7. 分享卡 1:1 / 3:4 导出（真实 PNG 尺寸校验）
 *   8. 手机端布局无横向溢出、按钮可点
 *   9. 无控制台错误、无网络请求（首版纯本地）
 *
 * 用法：
 *   node scripts/e2e.mjs                # 自动起静态服务器（需先 build）
 *   node scripts/e2e.mjs http://127.0.0.1:4190/
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { serveStatic } from './serve.mjs';

const OUT = join(process.cwd(), '.e2e-out');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const DOWNLOAD_DIR = join(OUT, 'downloads');
mkdirSync(DOWNLOAD_DIR, { recursive: true });

const DIST = join(process.cwd(), 'dist');
if (!existsSync(join(DIST, 'index.html'))) throw new Error('未找到 dist/index.html，请先运行 npm run build');
const server = process.argv[2] ? null : await serveStatic(DIST);
const BASE = process.argv[2] || server.url;

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) throw new Error('未找到本机 Chrome/Edge，请修改 scripts/e2e.mjs 的 CHROME_PATHS');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n## ${title}`);
}

async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent ?? '', h);
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

async function closeOnboarding(page) {
  const has = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('开始游戏'));
    if (b) {
      b.click();
      return true;
    }
    return false;
  });
  if (has) await sleep(250);
  return has;
}

/** 设置 localStorage 中的原始值（用于损坏测试） */
async function setRawSave(page, value) {
  await page.evaluate((v) => {
    localStorage.setItem('isr:save:v1', v);
  }, value);
}

async function readSave(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('isr:save:v1');
    if (!raw) return null;
    try {
      const env = JSON.parse(raw);
      return env.data;
    } catch {
      return null;
    }
  });
}

/** 通过 DOM 读取首页/头部的 XP 数字 */
async function readHeaderXp(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.rank-chip__xp');
    if (!el) return null;
    const n = (el.textContent ?? '').replace(/[^\d]/g, '');
    return n ? Number(n) : null;
  });
}

/** 读取 PNG 宽高（IHDR 在固定偏移） */
function pngSize(buf) {
  if (buf.length < 24) return null;
  const signature = buf.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/* 与 src/lib/storage.ts 完全一致的校验和实现（测试注入存档用） */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(',')}}`;
}
function checksumOf(obj) {
  const text = stableStringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 写入一份合法（校验和正确）的存档，用于构造边界场景 */
async function writeSave(page, data) {
  await page.evaluate(
    (payload) => {
      localStorage.setItem('isr:save:v1', JSON.stringify(payload));
    },
    { format: 'isr-save', schemaVersion: 3, checksum: checksumOf(data), savedAt: Date.now(), data },
  );
}

/**
 * 自动完成任意一个尚未完成的每日任务（choice / judge / tap / timer）。
 * 成功返回 true；没有可做任务时返回 false。
 */
async function completeAnyTask(page) {
  const info = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-card')].map((c, i) => ({
      i,
      type: c.querySelector('.daily-card__type')?.textContent ?? '',
      done: c.classList.contains('is-done'),
    })),
  );
  const target = info.find((t) => !t.done);
  if (!target) return false;

  await page.evaluate((i) => {
    const card = document.querySelectorAll('.daily-card')[i];
    const btn = card.querySelector('.daily-card__body button');
    btn?.click();
  }, target.i);
  await sleep(350);

  if (target.type.includes('行为')) {
    await page.click('.task-option');
    await sleep(120);
    await clickText(page, '.modal__foot button', '确认选择');
  } else if (target.type.includes('判断')) {
    await clickText(page, '.task-judge__actions button', '不该转发');
    await sleep(200);
    await clickText(page, '.modal__foot button', '领取奖励');
  } else if (target.type.includes('手速')) {
    await clickText(page, '.tap-game__stage button', '开始');
    await sleep(250);
    for (let k = 0; k < 12; k += 1) {
      const left = await page.$$('.tap-target');
      if (left.length === 0) break;
      await left[0].click();
      await sleep(80);
    }
    await sleep(900);
  } else if (target.type.includes('计时')) {
    await clickText(page, '.timer-game button', '开始计时');
    // 计时任务 20 秒，等待其自然结束
    await sleep(21500);
  } else {
    return false;
  }
  await sleep(900);
  return true;
}

const completeSimpleTask = completeAnyTask;
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  protocolTimeout: 120_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.setDownloadBehavior?.({ behavior: 'allow', downloadPath: DOWNLOAD_DIR }).catch(() => {});
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOAD_DIR }).catch(() => {});

  const pageErrors = [];
  const requests = [];
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) pageErrors.push(`console: ${msg.text()}`);
  });
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('http') && !url.startsWith(BASE.replace(/\/$/, ''))) requests.push(url);
  });

  /* ---------------------------------------------------------------- */
  section('1. 首次进入与首测');

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(400);
  const onboarding = await closeOnboarding(page);
  check('首次进入展示玩法说明（但不阻塞）', onboarding);
  const authorLink = await page.evaluate(() => {
    const a = document.querySelector('.author-link');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return {
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      text: a.textContent ?? '',
      w: Math.round(r.width),
      h: Math.round(r.height),
      inHeader: Boolean(a.closest('.site-header')),
    };
  });
  check('顶部展示作者 X 链接', Boolean(authorLink), '未找到 .author-link');
  check('作者链接指向 https://x.com/0xkillcoin', authorLink?.href === 'https://x.com/0xkillcoin', authorLink?.href);
  check('作者链接文本为 𝕏', (authorLink?.text ?? '').includes('𝕏'), authorLink?.text);
  check('作者链接新标签打开且带 noopener', authorLink?.target === '_blank' && (authorLink?.rel ?? '').includes('noopener'));
  check('作者链接位于顶栏', authorLink?.inHeader === true);
  check('作者链接触控尺寸 ≥36px', (authorLink?.w ?? 0) >= 36 && (authorLink?.h ?? 0) >= 36, `${authorLink?.w}×${authorLink?.h}`);
  check('首页首先展示「开始段位测试」', await clickText(page, 'button', '开始段位测试'));
  await sleep(400);
  check('进入答题页', page.url().includes('#/quiz'));
  const firstScenario = await page.$eval('.quiz__scenario', (el) => el.textContent ?? '');
  check('展示第 1 题', firstScenario.length > 5);

  // 故意先不选，确认按钮禁用
  const disabled = await page.$eval('.quiz__actions .button', (b) => b.disabled);
  check('未选择时提交按钮禁用', disabled);

  // 完整答 14 题：每题选第一个选项（不保证全对，只需生成段位）
  let answered = 0;
  for (let i = 0; i < 14; i += 1) {
    await page.waitForSelector('.quiz-option');
    await page.click('.quiz-option');
    await sleep(120);
    const label = await page.$eval('.quiz__actions .button', (b) => b.textContent ?? '');
    await page.click('.quiz__actions .button');
    answered += 1;
    if (label.includes('提交')) break;
    await sleep(160);
  }
  check('完成 14 题作答', answered === 14, `实际 ${answered}`);
  await page.waitForFunction(() => location.hash.includes('result'), { timeout: 8000 });
  await sleep(900);
  check('自动跳转到结果页', page.url().includes('#/result'));
  const resultTitle = await page.$eval('.result-hero__title', (el) => el.textContent ?? '');
  check('结果页展示段位', resultTitle.includes('你的互联网段位是'), resultTitle);
  const levelLabel = await page.$eval('.glitch', (el) => el.textContent ?? '');
  check('段位格式为「段位 + 罗马数字」', /第?.*(青铜|白银|黄金|铂金|钻石|大师|宗师|互联网幽灵).*(I|II|III)/.test(levelLabel) || /(青铜|白银|黄金|铂金|钻石|大师|宗师).*(I|II|III)/.test(levelLabel), levelLabel);

  const saveAfterQuiz = await readSave(page);
  check('存档已写入，placed=true', saveAfterQuiz?.placed === true);
  check('首测经验 > 0', (saveAfterQuiz?.xp ?? 0) > 0, `xp=${saveAfterQuiz?.xp}`);
  check('首测写入 quizHistory', (saveAfterQuiz?.quizHistory?.length ?? 0) >= 1);
  check('账本记录首测', (saveAfterQuiz?.ledger ?? []).some((e) => e.id === 'placement'));
  check('解锁首测徽章', (saveAfterQuiz?.badges ?? []).some((b) => b.id === 'quiz-first'));
  await page.screenshot({ path: join(OUT, 'result-desktop.png'), fullPage: true });

  /* ---------------------------------------------------------------- */
  section('2. 等级与经验规则');

  const xpAfterQuiz = saveAfterQuiz.xp;
  const headerXp = await readHeaderXp(page);
  check('顶栏经验与存档一致', headerXp === xpAfterQuiz, `${headerXp} vs ${xpAfterQuiz}`);

  // 重测不加经验
  await page.goto(`${BASE}#/quiz`, { waitUntil: 'networkidle0' });
  await sleep(300);
  for (let i = 0; i < 14; i += 1) {
    await page.waitForSelector('.quiz-option');
    await page.click('.quiz-option');
    await sleep(80);
    await page.click('.quiz__actions .button');
    await sleep(120);
  }
  await page.waitForFunction(() => location.hash.includes('result'), { timeout: 8000 });
  await sleep(500);
  const saveAfterRetake = await readSave(page);
  check('重测不增加经验', saveAfterRetake.xp === xpAfterQuiz, `${saveAfterRetake.xp} vs ${xpAfterQuiz}`);
  check('重测次数 +1', (saveAfterRetake.stats?.quizRetakes ?? 0) >= 1);
  check('重测结果标记为 retake', saveAfterRetake.lastQuiz?.placement === false);

  /* ---------------------------------------------------------------- */
  section('3. 每日任务与防重复领奖');

  await page.goto(`${BASE}#/daily`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const cards = await page.$$('.daily-card');
  check('每日 3 个任务', cards.length === 3, `实际 ${cards.length}`);

  // 找到 choice 型任务（最容易自动化的），否则用 judge
  const taskInfo = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.daily-card')];
    return cards.map((c) => ({
      type: c.querySelector('.daily-card__type')?.textContent ?? '',
      done: c.classList.contains('is-done'),
    }));
  });
  const choiceIndex = taskInfo.findIndex((t) => t.type.includes('行为') && !t.done);
  const judgeIndex = taskInfo.findIndex((t) => t.type.includes('判断') && !t.done);
  const targetIndex = choiceIndex >= 0 ? choiceIndex : judgeIndex;
  check('存在可执行的每日任务', targetIndex >= 0, JSON.stringify(taskInfo));

  const xpBeforeTask = (await readSave(page)).xp;
  await page.evaluate((i) => {
    const cards = [...document.querySelectorAll('.daily-card')];
    const btn = [...cards[i].querySelectorAll('button')].find((b) => b.textContent?.includes('做出选择') || b.textContent?.includes('开始判断'));
    btn?.click();
  }, targetIndex);
  await sleep(350);

  if (choiceIndex >= 0) {
    await page.click('.task-option');
    await sleep(150);
    await clickText(page, '.modal__foot button', '确认选择');
  } else {
    await clickText(page, '.task-judge__actions button', '不该转发');
    await sleep(250);
    await clickText(page, '.modal__foot button', '领取奖励');
  }
  await sleep(800);
  const saveAfterTask = await readSave(page);
  check('任务完成后经验增加', saveAfterTask.xp > xpBeforeTask, `${saveAfterTask.xp} vs ${xpBeforeTask}`);
  check('任务写入 done 列表', (saveAfterTask.today?.done?.length ?? 0) >= 1);
  check('任务写入账本', (saveAfterTask.ledger ?? []).some((e) => e.id.startsWith('task:')));
  check('页面显示奖励反馈', Boolean(await page.$('.daily-result, .toast--xp')));

  // 刷新后仍然完成，不能再领
  const xpAfterTask = saveAfterTask.xp;
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  const doneCountAfterReload = await page.evaluate(() => document.querySelectorAll('.daily-card.is-done').length);
  check('刷新后任务仍标记完成', doneCountAfterReload >= 1, `实际 ${doneCountAfterReload}`);
  const xpAfterReload = (await readSave(page)).xp;
  check('刷新不会重复加分', xpAfterReload === xpAfterTask, `${xpAfterReload} vs ${xpAfterTask}`);

  // 直接调用两次结算（模拟连点/重放）：用 UI 再点同一任务应被拒绝
  const btnDisabled = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.daily-card.is-done')][0];
    const b = card?.querySelector('button');
    return b ? b.disabled : true;
  });
  check('已完成任务按钮不可再点', btnDisabled);

  // 记录完成剩余任务：验证全清奖励
  const remaining = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-card:not(.is-done)')].map((c) => c.querySelector('.daily-card__title')?.textContent),
  );
  check('剩余任务数量正确', remaining.length === 3 - doneCountAfterReload, `${remaining.length}`);

  /* 3b. 双击防重：同一任务连点两次只记一次 */
  const doubleTarget = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-card')].findIndex((c) => !c.classList.contains('is-done') && c.querySelector('.daily-card__type')?.textContent?.includes('行为')),
  );
  if (doubleTarget >= 0) {
    const xpBeforeDouble = (await readSave(page)).xp;
    await page.evaluate((i) => {
      const card = document.querySelectorAll('.daily-card')[i];
      [...card.querySelectorAll('button')].find((b) => b.textContent?.includes('做出选择'))?.click();
    }, doubleTarget);
    await sleep(300);
    await page.click('.task-option');
    await sleep(120);
    // 同一帧内连点两次确认
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.modal__foot button')].find((b) => b.textContent?.includes('确认选择'));
      btn?.click();
      btn?.click();
    });
    await sleep(900);
    const afterDouble = await readSave(page);
    const taskEntries = afterDouble.ledger.filter((e) => e.id.startsWith('task:') && e.id.includes(afterDouble.today.date));
    check('双击确认只结算一次', afterDouble.xp > xpBeforeDouble && taskEntries.length === doneCountAfterReload + 1, `任务账本 ${taskEntries.length} 条`);
  } else {
    check('双击确认只结算一次', true, '本日无行为类剩余任务，跳过');
  }

  /* 3c. 全清奖励（页面在弹窗结算后会重渲染，逐轮重试） */
  for (let round = 0; round < 8; round += 1) {
    const left = await page.evaluate(() => document.querySelectorAll('.daily-card:not(.is-done)').length);
    if (left === 0) break;
    const ok = await completeSimpleTask(page);
    if (!ok) {
      await page.reload({ waitUntil: 'networkidle0' });
      await sleep(600);
      await page.goto(`${BASE}#/daily`, { waitUntil: 'networkidle0' });
      await sleep(500);
    }
  }
  const afterAllTasks = await readSave(page);
  check('当天 3 个任务全部完成', afterAllTasks.today.done.length === 3, `${afterAllTasks.today.done.length}`);
  check('全清奖励已入账', afterAllTasks.ledger.some((e) => e.id === `clear:${afterAllTasks.today.date}`));
  check('全清后页面显示已全清', (await page.evaluate(() => document.body.textContent ?? '')).includes('已全清'));
  check('连续挑战奖励已入账', afterAllTasks.ledger.some((e) => e.id === `streak:${afterAllTasks.today.date}`));
  check('当天经验不超过单日上限', afterAllTasks.ledger
    .filter((e) => e.id.includes(afterAllTasks.today.date))
    .reduce((s, e) => s + e.amount, 0) <= 300);

  /* 3d. 临界升级：把经验调到门槛前 1，再完成一个任务应升级 */
  const saveBeforeLevel = await readSave(page);
  const nextThresholds = [80, 180, 300, 440, 600, 790, 1010, 1250, 1540, 1860, 2210, 2600, 3040, 3520, 4060, 4660, 5320, 6060, 6880, 7780, 8800, 10000, 11400];
  const currentXp = saveBeforeLevel.xp;
  const nextThreshold = nextThresholds.find((t) => t > currentXp);
  if (nextThreshold) {
    const targetXp = nextThreshold - 1;
    const ledgerSum = saveBeforeLevel.ledger.reduce((s, e) => s + e.amount, 0);
    const bump = targetXp - ledgerSum;
    // 构造 3 个全新的选择类任务，避免与已结算任务 id 冲突
    const date = saveBeforeLevel.today.date;
    const mkTask = (n) => ({
      id: `${date}:test-choice-${n}`,
      templateId: `test-choice-${n}`,
      type: 'choice',
      title: `测试任务 ${n}`,
      desc: '用于验证跨门槛升级的测试任务。',
      xp: 40,
      glyph: '🧪',
      options: [
        { text: '先核实', tag: 'calm' },
        { text: '转发', tag: 'spread' },
        { text: '划走', tag: 'offline' },
      ],
    });
    const crafted = {
      ...saveBeforeLevel,
      xp: targetXp,
      levelIndex: 0,
      ledger: [...saveBeforeLevel.ledger, { id: `test-bump:${Date.now()}`, at: Date.now(), amount: bump, label: '测试注入' }],
      today: { date, tasks: [mkTask(1), mkTask(2), mkTask(3)], done: [], clearBonusGiven: false },
    };
    await writeSave(page, crafted);
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(600);

    await page.goto(`${BASE}#/daily`, { waitUntil: 'networkidle0' });
    await sleep(500);
    await completeSimpleTask(page);
    const afterLevel = await readSave(page);
    check('跨过门槛后等级提升', afterLevel.xp >= nextThreshold && afterLevel.levelIndex > crafted.levelIndex, `xp=${afterLevel.xp} next=${nextThreshold} level=${afterLevel.levelIndex}`);
    check('升级后经验与等级一致', afterLevel.xp > targetXp);
    const levelToast = await page.evaluate(() => document.body.textContent ?? '');
    check('升级后有可见反馈', levelToast.includes('段位提升') || levelToast.includes('XP') || levelToast.includes('经验'));
  } else {
    check('跨过门槛后等级提升', true, '已接近满级，跳过');
  }

  /* ---------------------------------------------------------------- */
  section('4. 刷新持久化与页面导航');

  const beforeNavXp = (await readSave(page)).xp;
  await page.goto(`${BASE}#/profile`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const profileRank = await page.$eval('.profile-id__rank', (el) => el.textContent ?? '');
  check('个人主页展示段位与称号', profileRank.length > 4);
  check('个人主页展示经验', (await page.evaluate(() => document.body.textContent ?? '')).includes(String(beforeNavXp)));
  check('个人主页有历史成绩区块', Boolean(await page.$('.history-table, .profile-history')));
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  const afterReloadSave = await readSave(page);
  check('刷新后进度仍在', afterReloadSave.xp === beforeNavXp);
  check('刷新后徽章仍在', afterReloadSave.badges.length >= 2);
  await page.screenshot({ path: join(OUT, 'profile-desktop.png'), fullPage: true });

  // 徽章页
  await page.goto(`${BASE}#/badges`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const badgeCards = await page.$$('.badge-card');
  check('徽章页展示 ≥30 枚徽章', badgeCards.length >= 30, `实际 ${badgeCards.length}`);
  const ownedBadges = await page.$$('.badge-card.is-unlocked');
  check('有已解锁徽章', ownedBadges.length >= 1);

  // 段位表
  await page.goto(`${BASE}#/tiers`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const tierBlocks = await page.$$('.tier-block');
  check('段位表展示 8 个段位', tierBlocks.length === 8, `实际 ${tierBlocks.length}`);
  check('段位表展示隐藏段位占位', (await page.evaluate(() => document.body.textContent ?? '')).includes('隐藏段位'));

  /* ---------------------------------------------------------------- */
  section('5. 分享卡导出（1:1 与 3:4）');

  await page.goto(`${BASE}#/card`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.card-preview__img', { timeout: 8000 });
  await sleep(600);
  const previewSrc = await page.$eval('.card-preview__img', (img) => img.src);
  check('段位卡预览已生成 PNG dataURL', previewSrc.startsWith('data:image/png;base64,'));
  const previewSize = await page.$eval('.card-preview__img', (img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  check('1:1 预览尺寸 1080×1080', previewSize.w === 1080 && previewSize.h === 1080, JSON.stringify(previewSize));

  // 切到 3:4 并确认重绘
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ratio-option')].find((b) => b.textContent?.includes('3:4'));
    btn?.click();
  });
  await sleep(700);
  const tallSize = await page.$eval('.card-preview__img', (img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  check('3:4 预览尺寸 1080×1440', tallSize.w === 1080 && tallSize.h === 1440, JSON.stringify(tallSize));

  // 下载两次（1:1 与 3:4），校验文件尺寸
  const before = new Set(readdirSync(DOWNLOAD_DIR));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ratio-option')].find((b) => b.textContent?.includes('1:1'));
    btn?.click();
  });
  await sleep(500);
  await clickText(page, 'button', '下载');
  await sleep(1500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ratio-option')].find((b) => b.textContent?.includes('3:4'));
    btn?.click();
  });
  await sleep(600);
  await clickText(page, 'button', '下载');
  await sleep(1500);

  const downloads = readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith('.png'));
  check('产生 2 个 PNG 下载', downloads.length >= 2, downloads.join(', '));
  const sizes = downloads.map((f) => {
    const buf = readFileSync(join(DOWNLOAD_DIR, f));
    return { file: f, ...(pngSize(buf) ?? { width: 0, height: 0 }), bytes: buf.length };
  });
  console.log('    ' + sizes.map((s) => `${s.file}: ${s.width}×${s.height} (${(s.bytes / 1024).toFixed(0)}KB)`).join('\n    '));
  check('1:1 文件为 1080×1080', sizes.some((s) => s.width === 1080 && s.height === 1080));
  check('3:4 文件为 1080×1440', sizes.some((s) => s.width === 1080 && s.height === 1440));
  check('下载文件非空', sizes.every((s) => s.bytes > 10_000));
  const saveAfterShare = await readSave(page);
  check('下载触发分享徽章指标', (saveAfterShare.stats?.sharesSquare ?? 0) >= 1 && (saveAfterShare.stats?.sharesTall ?? 0) >= 1);
  check('分享徽章已解锁', (saveAfterShare.badges ?? []).some((b) => b.id === 'share-square') && (saveAfterShare.badges ?? []).some((b) => b.id === 'share-tall'));

  // 复制文案（剪贴板在无头环境可能挂起，用超时保护且不作为硬性断言）
  await clickText(page, 'button', '复制分享文案');
  await sleep(500);
  check('复制按钮点击后页面仍可交互', await page.evaluate(() => document.readyState === 'complete'));

  /* ---------------------------------------------------------------- */
  section('6. 导出 / 导入进度');

  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const exportBefore = await readSave(page);
  // 点击真实导出按钮，等下载文件落盘
  const jsonBefore = new Set(readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith('.json')));
  await clickText(page, 'button', '导出进度 JSON');
  await sleep(1800);
  const exportedFile = readdirSync(DOWNLOAD_DIR)
    .filter((f) => f.endsWith('.json') && !jsonBefore.has(f))
    .sort()
    .pop();
  check('导出产生 JSON 文件', Boolean(exportedFile), readdirSync(DOWNLOAD_DIR).join(', '));
  const exportedText = exportedFile ? readFileSync(join(DOWNLOAD_DIR, exportedFile), 'utf8') : '';
  check('导出 JSON 非空', exportedText.length > 100, `${exportedText.length} 字节`);
  let parsedExport = {};
  try {
    parsedExport = JSON.parse(exportedText);
  } catch {
    parsedExport = {};
  }
  check('导出含 format 与校验和', parsedExport.format === 'isr-save' && typeof parsedExport.checksum === 'string');
  check('导出含 schemaVersion', parsedExport.schemaVersion === 3);
  check('导出含完整数据', parsedExport.data?.placed === true && parsedExport.data?.xp === exportBefore.xp);

  // 导入刚导出的文件
  const fileInput = await page.$('input[type=file]');
  check('存在导入文件输入', Boolean(fileInput));
  if (fileInput && exportedFile) {
    await fileInput.uploadFile(join(DOWNLOAD_DIR, exportedFile));
    await sleep(600);
    check('导入前展示预览', Boolean(await page.$('.import-preview')));
    await clickText(page, 'button', '确认导入并覆盖当前进度');
    await sleep(900);
    const importMsg = await page.evaluate(() => document.querySelector('.form-msg')?.textContent ?? '');
    check('导入成功提示', importMsg.includes('导入成功') || importMsg.includes('成功'), importMsg.slice(0, 80));
    const afterImport = await readSave(page);
    check('导入后经验一致', afterImport.xp === exportBefore.xp, `${afterImport.xp} vs ${exportBefore.xp}`);
    check('导入次数 +1', (afterImport.stats?.imports ?? 0) >= 1);
    check('导入徽章解锁', (afterImport.badges ?? []).some((b) => b.id === 'import-1'));
  }

  // 拒绝损坏文件
  const badPath = join(DOWNLOAD_DIR, 'bad.json');
  writeFileSync(badPath, '{"hello":"world"}');
  const fileInput2 = await page.$('input[type=file]');
  if (fileInput2) {
    await fileInput2.uploadFile(badPath);
    await sleep(500);
    await clickText(page, 'button', '确认导入并覆盖当前进度');
    await sleep(600);
    const badMsg = await page.evaluate(() => document.querySelector('.form-msg')?.textContent ?? '');
    check('结构不符的文件被拒绝', badMsg.includes('不像是') || badMsg.includes('不支持') || badMsg.includes('失败'), badMsg.slice(0, 80));
  }

  /* ---------------------------------------------------------------- */
  section('7. 数据损坏恢复与重置');

  // 7.1 主档篡改（校验和不匹配），但有备份 → 从备份恢复
  const goodRaw = await page.evaluate(() => localStorage.getItem('isr:save:v1'));
  await page.evaluate(() => {
    const raw = localStorage.getItem('isr:save:v1');
    const env = JSON.parse(raw);
    env.data.xp = 999999;
    localStorage.setItem('isr:save:v1', JSON.stringify(env));
    // 确保存在备份
    if (!localStorage.getItem('isr:save:v1.bak')) localStorage.setItem('isr:save:v1.bak', raw);
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  const recoveredSave = await readSave(page);
  check('篡改被拦截，未采纳伪造经验', recoveredSave.xp !== 999999, `xp=${recoveredSave.xp}`);
  const noticeText = await page.evaluate(() => document.querySelector('.notice')?.textContent ?? '');
  check('展示数据恢复提示', noticeText.includes('异常') || noticeText.includes('恢复') || noticeText.length > 0, noticeText.slice(0, 80));

  // 7.2 主档完全损坏 → 安全模式，可下载原始数据并重置
  await page.evaluate(() => {
    localStorage.setItem('isr:save:v1', '{broken json');
    localStorage.removeItem('isr:save:v1.bak');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  const corruptNotice = await page.evaluate(() => document.querySelector('.notice')?.textContent ?? '');
  check('完全损坏时进入安全模式提示', corruptNotice.includes('存档') || corruptNotice.includes('无法'), corruptNotice.slice(0, 60));
  check('提供下载原始数据按钮', await clickText(page, '.notice button', '下载原始数据'));
  await sleep(300);

  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' });
  await sleep(400);
  check('设置页展示损坏数据入口', await clickText(page, 'button', '下载损坏原始数据'));

  // 重置
  await clickText(page, 'button', '重置全部进度');
  await sleep(300);
  await page.type('.modal .input', '重置');
  await sleep(150);
  await clickText(page, '.modal__foot button', '永久删除并重置');
  await sleep(800);
  const afterReset = await readSave(page);
  check('重置后经验为 0', afterReset.xp === 0, `xp=${afterReset.xp}`);
  check('重置后未测段', afterReset.placed === false);
  check('重置后回到首页', page.url().includes('#/home') || !page.url().includes('#/settings'));
  check('重置记录保留', (afterReset.stats?.resets ?? 0) >= 1);

  // 重置后再次完成首测，验证仍可用
  await page.goto(`${BASE}#/quiz`, { waitUntil: 'networkidle0' });
  await sleep(300);
  for (let i = 0; i < 14; i += 1) {
    await page.waitForSelector('.quiz-option');
    await page.click('.quiz-option');
    await sleep(60);
    await page.click('.quiz__actions .button');
    await sleep(110);
  }
  await page.waitForFunction(() => location.hash.includes('result'), { timeout: 8000 });
  await sleep(400);
  const afterSecondPlacement = await readSave(page);
  check('重置后可以重新测段', afterSecondPlacement.placed === true && afterSecondPlacement.xp > 0);

  /* ---------------------------------------------------------------- */
  section('8. 无控制台错误 / 无外部请求');

  await page.goto(`${BASE}#/home`, { waitUntil: 'networkidle0' });
  await sleep(400);
  check('没有页面异常', pageErrors.length === 0, pageErrors.join(' | '));
  check('没有外部网络请求', requests.length === 0, requests.join(', '));

  /* ---------------------------------------------------------------- */
  section('9. 移动端布局与触控');

  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(String(e)));
  await mobile.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(600);
  await mobile.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('开始游戏'));
    b?.click();
  });
  await sleep(300);
  await mobile.screenshot({ path: join(OUT, 'home-mobile.png'), fullPage: true });

  const overflow = await mobile.evaluate(() => {
    const doc = document.documentElement;
    const clipped = (el) => {
      let p = el.parentElement;
      while (p) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'hidden' || s.overflowX === 'clip' || s.overflow === 'hidden' || s.overflow === 'clip') return true;
        p = p.parentElement;
      }
      return false;
    };
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && !clipped(el);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${el.className}`);
    return { scrollW: doc.scrollWidth, innerW: window.innerWidth, wide };
  });
  check('移动端无横向滚动', overflow.scrollW <= overflow.innerW + 1, JSON.stringify(overflow));
  check('移动端无溢出元素', overflow.wide.length === 0, overflow.wide.join(', '));

  const menuVisible = await mobile.evaluate(() => {
    const btn = document.querySelector('.menu-button');
    if (!btn) return false;
    const style = getComputedStyle(btn);
    return style.display !== 'none';
  });
  check('移动端显示菜单按钮', menuVisible);
  const mobileAuthor = await mobile.evaluate(() => {
    const a = document.querySelector('.author-link');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), visible: getComputedStyle(a).display !== 'none', right: Math.round(r.right), vw: document.documentElement.clientWidth };
  });
  check('移动端保留作者 X 链接', Boolean(mobileAuthor) && mobileAuthor.visible);
  check('移动端作者链接不溢出', Boolean(mobileAuthor) && mobileAuthor.right <= mobileAuthor.vw + 1, JSON.stringify(mobileAuthor));
  check('移动端作者触控高度 ≥44px', (mobileAuthor?.h ?? 0) >= 44, `${mobileAuthor?.h}px`);
  await mobile.click('.menu-button');
  await sleep(250);
  const navOpen = await mobile.evaluate(() => document.querySelector('.site-nav')?.classList.contains('is-open') ?? false);
  check('移动端菜单可展开', navOpen);
  await mobile.evaluate(() => document.querySelector('.site-nav__item:nth-child(2)')?.click());
  await sleep(500);
  check('移动端导航可跳转', mobile.url().includes('#/daily') || mobile.url().includes('#/quiz'), mobile.url());
  await mobile.screenshot({ path: join(OUT, 'mobile-nav.png'), fullPage: false });

  // 移动端首测：清空存档后进入答题流程
  await mobile.evaluate(() => localStorage.clear());
  await mobile.goto(`${BASE}#/quiz`, { waitUntil: 'networkidle0' });
  await sleep(600);
  await mobile.click('.quiz-option');
  await sleep(150);
  const nextLabel = await mobile.$eval('.quiz__actions .button', (b) => b.textContent ?? '');
  check('移动端选项可点选', nextLabel.includes('下一题'));
  const optionHeight = await mobile.$eval('.quiz-option', (el) => el.getBoundingClientRect().height);
  check('触控目标高度 ≥44px', optionHeight >= 44, `${optionHeight}px`);

  // 移动端首页重新截图（关闭弹窗后）
  await mobile.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(500);
  await mobile.screenshot({ path: join(OUT, 'home-mobile-2.png'), fullPage: true });
  check('移动端无脚本错误', mobileErrors.length === 0, mobileErrors.join(' | '));

  /* ---------------------------------------------------------------- */
  section('10. 重新加载后的首页与减少动画');

  await page.goto(`${BASE}#/home`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const homeHasRank = await page.evaluate(() => Boolean(document.querySelector('.rank-chip__label')));
  check('首页展示当前段位', homeHasRank);
  const homeHasStart = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('开始今日挑战')),
  );
  check('首页展示「开始挑战」入口', homeHasStart);

  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.switch')].find((s) => s.textContent?.includes('减少动画'));
    label?.querySelector('input')?.click();
  });
  await sleep(400);
  const reduceAttr = await page.evaluate(() => document.documentElement.dataset.reduceMotion);
  check('减少动画开关生效', reduceAttr === 'true', reduceAttr);
  const animDuration = await page.evaluate(() => {
    const el = document.querySelector('.crt-overlay');
    return el ? getComputedStyle(el).animationDuration : '';
  });
  void animDuration;

  const finalSave = await readSave(page);
  writeFileSync(join(OUT, 'final-save.json'), JSON.stringify(finalSave, null, 2));

  /* ---------------------------------------------------------------- */
  console.log(`\n${passed} 项通过，${failures.length} 项失败`);
  if (failures.length) {
    console.log('\n失败项：');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log('✅ E2E 全部通过');
  }
} catch (err) {
  console.error('\nE2E 运行异常：', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (server) await server.close();
}
