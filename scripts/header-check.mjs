/**
 * 顶栏极限宽度检查：超长称号 + 小屏（320/280px）+ 作者链接可点性
 * 用法：node scripts/header-check.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const DIST = join(process.cwd(), 'dist');
const server = await serveStatic(DIST);
const BASE = server.url;
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// 造一个「宗师 III」的存档（最长称号：数字生存大师 / 网络民俗学者）
await page.evaluate(() => {
  const data = {
    schemaVersion: 3,
    salt: 'headercheck123456',
    nickname: '测试昵称最多十二个字啊啊啊',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    xp: 7780,
    levelIndex: 20,
    placed: true,
    lastQuiz: { at: Date.now(), date: '2026-10-25', questionIds: [], correctFlags: [], correctCount: 12, total: 14, percent: 86, levelIndex: 9, axes: { info: 6, social: 4, vibe: 4 }, placement: true },
    quizHistory: [],
    axes: { info: 6, social: 4, vibe: 4 },
    today: { date: '2026-10-25', tasks: [], done: [], clearBonusGiven: false },
    history: [],
    ledger: [{ id: 'placement', at: Date.now(), amount: 7780, label: 'test' }],
    badges: [],
    stats: { tasksCompleted: 0, perfectDays: 0, bestStreak: 0, currentStreak: 0, lastActiveDate: null, distinctDays: [], nightTasks: 0, calmChoices: 0, offlineChoices: 0, fightChoices: 0, browseChoices: 0, spreadChoices: 0, judgeCorrect: 0, tapWins: 0, timerDone: 0, sharesSquare: 0, sharesTall: 0, imports: 0, resets: 0, corruptRecoveries: 0, tierListViews: 0, quizRetakes: 0, lastResetAt: null },
    reduceMotion: false,
    autoRepaired: false,
  };
  const stable = (v) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  };
  const text = stable(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const checksum = h.toString(16).padStart(8, '0');
  localStorage.setItem('isr:save:v1', JSON.stringify({ format: 'isr-save', schemaVersion: 3, checksum, savedAt: Date.now(), data }));
  localStorage.setItem('isr:onboarded:v1', '1');
});

for (const width of [320, 360, 375, 390, 430, 768]) {
  const p2 = await browser.newPage();
  await p2.setViewport({ width, height: 800, isMobile: false, hasTouch: true, deviceScaleFactor: 2 });
  await p2.goto(`${BASE}#/home`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));
  const info = await p2.evaluate(() => {
    const h = document.querySelector('.site-header__inner');
    const kids = [...h.children]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { cls: String(c.className).split(' ')[0], w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) };
      })
      .filter((k) => k.w > 0);
    const a = document.querySelector('.author-link');
    const ar = a.getBoundingClientRect();
    return {
      vw: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      brand: Math.round(document.querySelector('.brand').getBoundingClientRect().width),
      status: Math.round(document.querySelector('.site-header__status').getBoundingClientRect().width),
      kids,
      author: { w: Math.round(ar.width), h: Math.round(ar.height), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') },
      rankLabel: document.querySelector('.rank-chip__label')?.textContent,
      xpText: document.querySelector('.rank-chip__xp')?.textContent,
      overlap: kids.some((k, i) => i > 0 && k.left < kids[i - 1].right - 1),
    };
  });
  console.log(JSON.stringify({ width, ...info }));
  await p2.close();
}
await browser.close();
await server.close();
