/**
 * 生成 README / 仓库展示用截图
 * ------------------------------------------------------------------
 * 用一个「宗师 II」的演示存档（不写入任何真实用户数据）渲染各页面，
 * 输出到 docs/screenshots/，再由 scripts/optimize-shots.py 压成 webp。
 *
 * 用法：npm run build && node scripts/capture-shots.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const DIST = join(process.cwd(), 'dist');
if (!existsSync(join(DIST, 'index.html'))) throw new Error('请先 npm run build');
const OUT = join(process.cwd(), 'docs', 'screenshots');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('未找到 Chrome/Edge');

/* ---------------- 演示存档 ---------------- */

function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
    .join(',')}}`;
}
function checksum(obj) {
  const text = stable(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const now = Date.now();
const DAY = 86400000;
const dateOf = (offset) => {
  const d = new Date(now + offset * DAY);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
};

const taskPool = [
  {
    templateId: 'choice-hot-take',
    type: 'choice',
    title: '血压管理',
    desc: '刷到一条明显引战的帖子，你打算怎么处理？',
    xp: 40,
    glyph: '😤',
    options: [
      { text: '截图存档，等时间线齐了再说', tag: 'calm' },
      { text: '先回一句，气势不能输', tag: 'fight' },
      { text: '划走，去看点别的', tag: 'browse' },
    ],
  },
  {
    templateId: 'tap-popups',
    type: 'tap',
    title: '弹窗清扫',
    desc: '在 12 秒内点掉 6 个弹窗，还自己一个清净首页。',
    xp: 40,
    glyph: '🧹',
    targets: 6,
    timeLimitMs: 12000,
  },
  {
    templateId: 'judge-forward',
    type: 'judge',
    title: '转发判断',
    desc: '判断这条消息到底该不该转发。',
    xp: 45,
    glyph: '🔍',
    judgeId: 'j01',
  },
];

const today = dateOf(0);
const makeDay = (offset, doneCount) => {
  const date = dateOf(offset);
  return {
    date,
    tasks: taskPool.map((t, i) => ({ ...t, id: `${date}:${t.templateId}${i}` })),
    done: taskPool.slice(0, doneCount).map((t, i) => `${date}:${t.templateId}${i}`),
    clearBonusGiven: doneCount >= 3,
  };
};

const quizAxes = { info: 8, social: 3, vibe: 3 };
const lastQuiz = {
  at: now - 2 * DAY,
  date: dateOf(-2),
  questionIds: ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10', 'q11', 'q12', 'q13', 'q14'],
  correctFlags: [true, true, true, true, true, true, true, true, true, true, true, true, false, false],
  correctCount: 12,
  total: 14,
  percent: 86,
  levelIndex: 9,
  axes: quizAxes,
  placement: true,
};

const xp = 7120;
const demoSave = {
  schemaVersion: 3,
  salt: 'demo-salt-2026abc',
  nickname: '量子冲浪者',
  createdAt: now - 40 * DAY,
  updatedAt: now - 3600 * 1000,
  xp,
  levelIndex: 19,
  placed: true,
  lastQuiz,
  quizHistory: [
    lastQuiz,
    { ...lastQuiz, at: now - 12 * DAY, date: dateOf(-12), placement: false, correctCount: 11, percent: 79 },
    { ...lastQuiz, at: now - 25 * DAY, date: dateOf(-25), placement: false, correctCount: 10, percent: 71 },
  ],
  axes: quizAxes,
  today: makeDay(0, 1),
  history: [makeDay(-1, 3), makeDay(-2, 3), makeDay(-3, 2), makeDay(-5, 3), makeDay(-6, 3), makeDay(-7, 2)],
  ledger: [
    // 账本总和必须正好等于 xp：1270 + 90×65 = 7120
    { id: 'placement', at: now - 40 * DAY, amount: 1270, label: '首测段位结算' },
    ...Array.from({ length: 90 }, (_, i) => ({
      id: `task:${dateOf(-i % 30)}:demo-${i}`,
      at: now - i * DAY,
      amount: 65,
      label: '每日任务',
    })),
  ],
  badges: [
    'rank-bronze',
    'rank-silver',
    'rank-gold',
    'rank-platinum',
    'rank-diamond',
    'rank-master',
    'quiz-first',
    'quiz-sharp',
    'quiz-retake',
    'daily-first',
    'daily-10',
    'daily-30',
    'daily-60',
    'daily-clear1',
    'daily-clear7',
    'streak-3',
    'streak-7',
    'streak-14',
    'calm-10',
    'offline-10',
    'judge-10',
    'tap-5',
    'timer-5',
    'share-square',
    'share-tall',
    'import-1',
    'tierlist-1',
    'reset-1',
    'xp-3000',
  ].map((id, i) => ({ id, at: now - (30 - i) * DAY })),
  stats: {
    tasksCompleted: 96,
    perfectDays: 24,
    bestStreak: 21,
    currentStreak: 17,
    lastActiveDate: today,
    distinctDays: Array.from({ length: 24 }, (_, i) => dateOf(-i)),
    nightTasks: 11,
    calmChoices: 22,
    offlineChoices: 14,
    fightChoices: 5,
    browseChoices: 18,
    spreadChoices: 2,
    judgeCorrect: 15,
    tapWins: 8,
    timerDone: 9,
    sharesSquare: 3,
    sharesTall: 2,
    imports: 1,
    resets: 1,
    corruptRecoveries: 0,
    tierListViews: 2,
    quizRetakes: 2,
    lastResetAt: null,
  },
  reduceMotion: false,
  autoRepaired: false,
};
const envelope = { format: 'isr-save', schemaVersion: 3, checksum: checksum(demoSave), savedAt: now, data: demoSave };
const SAVE_JSON = JSON.stringify(envelope);

/* ---------------- 截图 ---------------- */

const server = await serveStatic(DIST);
const BASE = server.url;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  protocolTimeout: 180_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--force-color-profile=srgb'],
});

async function newPage({ width, height, dpr = 2, mobile = false }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: false, hasTouch: mobile });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate((json) => {
    localStorage.setItem('isr:save:v1', json);
    localStorage.setItem('isr:onboarded:v1', '1');
  }, SAVE_JSON);
  // 必须整页重载，应用才会在启动时读到刚写入的存档
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  const check = await page.evaluate(() => ({
    xp: document.querySelector('.rank-chip__xp')?.textContent ?? '',
    title: document.querySelector('.rank-chip__label')?.textContent ?? '',
  }));
  if (!check.xp.includes('7120')) {
    throw new Error(`演示存档未生效（顶栏：${check.title} / ${check.xp || '空'}）`);
  }
  console.log(`demo save loaded: ${check.title} · ${check.xp}`);
  return page;
}

async function shot(page, hash, file, { full = false, after = 900, scrollTo = 0 } = {}) {
  // 用 location.assign + reload 确保 hash 路由切换后整页状态一致
  await page.goto(`${BASE}${hash}`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, after));
  if (scrollTo) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
    await new Promise((r) => setTimeout(r, 350));
  }
  await page.screenshot({ path: join(OUT, file), fullPage: full, captureBeyondViewport: full });
  console.log('saved', file);
}

const desktop = await newPage({ width: 1440, height: 900 });
await shot(desktop, '#/home', 'home-desktop.png');
await shot(desktop, '#/result', 'result-desktop.png', { after: 1400 });
await shot(desktop, '#/daily', 'daily-desktop.png');
await shot(desktop, '#/badges', 'badges-desktop.png', { after: 1000 });
await shot(desktop, '#/profile', 'profile-desktop.png', { after: 1100 });
await shot(desktop, '#/card', 'card-desktop.png', { after: 1600 });
await shot(desktop, '#/tiers', 'tiers-desktop.png', { after: 900 });
await shot(desktop, '#/settings', 'settings-desktop.png', { after: 800 });
await shot(desktop, '#/quiz', 'quiz-desktop.png', { after: 700 });
await desktop.close();

/* 手机端 */
const mobile = await newPage({ width: 390, height: 844, dpr: 3, mobile: true });
await shot(mobile, '#/home', 'home-mobile.png', { after: 1100 });
await shot(mobile, '#/daily', 'daily-mobile.png', { after: 900 });
await shot(mobile, '#/card', 'card-mobile.png', { after: 1600 });
await mobile.close();

/* 分享卡导出图（1:1 与 3:4 的真实产物） */
const cardPage = await newPage({ width: 1200, height: 1200, dpr: 1 });
await cardPage.goto(`${BASE}#/card`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1800));
for (const [ratio, name] of [
  ['1:1', 'share-card-square.png'],
  ['3:4', 'share-card-tall.png'],
]) {
  await cardPage.evaluate((label) => {
    [...document.querySelectorAll('.ratio-option')].find((b) => b.textContent?.includes(label))?.click();
  }, ratio);
  await new Promise((r) => setTimeout(r, 1200));
  const dataUrl = await cardPage.$eval('.card-preview__img', (img) => img.src);
  const base64 = dataUrl.split(',')[1];
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, name), Buffer.from(base64, 'base64'));
  console.log('saved', name);
}
await cardPage.close();

await browser.close();
await server.close();
console.log('\nAll screenshots written to docs/screenshots/');
