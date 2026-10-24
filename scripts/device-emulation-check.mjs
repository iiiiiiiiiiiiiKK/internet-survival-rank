/**
 * 用 CDP 的 Emulation.setDeviceMetricsOverride 做「真·移动端」模拟，
 * 验证 meta viewport + 布局在 iPhone 各机型下正确（clientWidth 应等于逻辑宽度）。
 * 用法：node scripts/device-emulation-check.mjs
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  protocolTimeout: 60000,
});

const IPHONES = [
  { name: 'iPhone SE (3rd)', w: 375, h: 667, dpr: 2 },
  { name: 'iPhone 13 mini', w: 375, h: 812, dpr: 3 },
  { name: 'iPhone 15', w: 393, h: 852, dpr: 3 },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932, dpr: 3 },
];

const ROUTES = ['#/home', '#/quiz', '#/daily', '#/badges', '#/profile', '#/card', '#/settings', '#/tiers'];
let problems = 0;

for (const ip of IPHONES) {
  const page = await browser.newPage();
  const client = await page.createCDPSession();
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: ip.w,
    height: ip.h,
    deviceScaleFactor: ip.dpr,
    mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.setItem('isr:onboarded:v1', '1'));
  console.log(`\n## ${ip.name} ${ip.w}×${ip.h} @${ip.dpr}x`);
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const vw = doc.clientWidth;
      const hiddenOverflow = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || getComputedStyle(el).position === 'fixed') return false;
        if (r.right <= vw + 2 && r.left >= -2) return false;
        let p = el.parentElement;
        while (p) {
          const s = getComputedStyle(p);
          if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX) || ['hidden', 'clip'].includes(s.overflow)) return false;
          p = p.parentElement;
        }
        return true;
      });
      const header = document.querySelector('.site-header__inner');
      const hr = header.getBoundingClientRect();
      return {
        innerWidth,
        clientWidth: vw,
        visualViewport: Math.round(visualViewport.width),
        scrollWidth: doc.scrollWidth,
        headerRight: Math.round(hr.right),
        headerOverflow: hr.right > vw + 1 || hr.left < -1,
        overlapCount: hiddenOverflow.length,
        tapOk: (() => {
          const a = document.querySelector('.author-link');
          const r = a.getBoundingClientRect();
          return r.width >= 36 && r.height >= 40;
        })(),
      };
    });
    const issues = [];
    if (m.clientWidth !== ip.w) issues.push(`clientWidth=${m.clientWidth} 期望 ${ip.w}`);
    if (m.visualViewport !== ip.w) issues.push(`visualViewport=${m.visualViewport}`);
    if (m.scrollWidth > ip.w + 1) issues.push(`横向滚动 ${m.scrollWidth}`);
    if (m.headerOverflow) issues.push('顶栏溢出');
    if (m.overlapCount > 0) issues.push(`${m.overlapCount} 个越界元素`);
    if (!m.tapOk) issues.push('作者链接触控区过小');
    problems += issues.length;
    console.log(`  ${issues.length ? '✗' : '✓'} ${route}  (cw=${m.clientWidth}, vv=${m.visualViewport}, sw=${m.scrollWidth})${issues.length ? ' — ' + issues.join('；') : ''}`);
  }
  await page.close();
}

await browser.close();
await server.close();
console.log(problems ? `\n❌ ${problems} 个问题` : '\n✅ 四款 iPhone 模拟下全部页面通过');
if (problems) process.exitCode = 1;
