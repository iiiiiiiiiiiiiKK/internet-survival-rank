/**
 * 线上部署冒烟：用真实浏览器打开线上地址，确认 SPA 能加载、首测能开始、无控制台错误。
 * 用法：node scripts/live-check.mjs [url]
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.argv[2] || 'https://321.market/internet-survival-rank/';
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('未找到 Chrome/Edge');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  protocolTimeout: 60_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewport({ width: 1280, height: 900 });
  const resp = await page.goto(URL, { waitUntil: 'networkidle0', timeout: 45_000 });
  check('HTTP 200', resp?.status() === 200, String(resp?.status()));
  await new Promise((r) => setTimeout(r, 800));

  const title = await page.title();
  check('页面标题正确', title.includes('互联网生存段位'), title);
  check('React 已挂载', Boolean(await page.$('.app-shell')));
  check('作者 X 链接存在', await page.evaluate(() => document.querySelector('.author-link')?.getAttribute('href') === 'https://x.com/0xkillcoin'));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('开始游戏'));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('开始段位测试'))?.click();
  });
  await page.waitForSelector('.quiz-option', { timeout: 10_000 });
  check('首测页面可进入并渲染选项', (await page.$$('.quiz-option')).length === 3);

  // 直接访问 hash 路由（模拟刷新深链接）
  await page.goto(`${URL}#/tiers`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  check('深链接 #/tiers 刷新后正常', (await page.$$('.tier-block')).length === 8);

  check('无控制台/脚本错误', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.screenshot({ path: 'docs/screenshots/live-home.png', fullPage: false });
} finally {
  await browser.close();
}

console.log(`\n${passed} 项通过，${failures.length} 项失败`);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('✅ 线上部署验证通过');
}
