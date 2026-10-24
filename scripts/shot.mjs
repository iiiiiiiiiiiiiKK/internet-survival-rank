/**
 * 浏览器截图 + 快速冒烟：确认页面能渲染、无控制台报错。
 * 用法：node scripts/shot.mjs [baseUrl] [outDir]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4190/';
const OUT = process.argv[3] || '.shots';
mkdirSync(OUT, { recursive: true });

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) throw new Error('未找到 Chrome/Edge');

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  // 关闭首次进入的说明弹窗
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('开始游戏'));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(OUT, 'home-desktop.png'), fullPage: true });
  console.log('saved', join(OUT, 'home-desktop.png'));
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  else console.log('no console errors');
} finally {
  await browser.close();
}
