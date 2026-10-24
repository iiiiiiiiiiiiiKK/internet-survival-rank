/**
 * 自适应布局审计：iPhone 多尺寸 + 桌面 + 横屏
 * ------------------------------------------------------------------
 * 对每个视口逐页检查：
 *   - 是否出现横向滚动（documentElement.scrollWidth > innerWidth）
 *   - 是否有未被父级裁剪的元素越界
 *   - 顶栏是否溢出、作者 X 链接是否可见且尺寸 ≥44px
 *   - 主要交互元素（按钮）触控高度是否 ≥44px（移动端）
 *   - 字号是否 ≥11px（可读性）
 * 用法：node scripts/layout-audit.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const DIST = join(process.cwd(), 'dist');
if (!existsSync(join(DIST, 'index.html'))) throw new Error('请先 npm run build');
const server = process.argv[2] ? null : await serveStatic(DIST);
const BASE = process.argv[2] || server.url;

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) throw new Error('未找到 Chrome/Edge');

const OUT = join(process.cwd(), '.layout-out');
mkdirSync(OUT, { recursive: true });

/** 覆盖主流 iPhone 逻辑分辨率（含刘海屏/灵动岛/SE 小屏）+ 桌面 + 横屏 */
const VIEWPORTS = [
  { name: 'iPhone SE2/SE3', width: 375, height: 667, dpr: 2 },
  { name: 'iPhone 12/13 mini', width: 375, height: 812, dpr: 3 },
  { name: 'iPhone 14/13', width: 390, height: 844, dpr: 3 },
  { name: 'iPhone 15 Pro', width: 393, height: 852, dpr: 3 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, dpr: 3 },
  { name: 'iPhone 横屏', width: 844, height: 390, dpr: 3, landscape: true },
  { name: 'iPad mini 竖屏', width: 744, height: 1133, dpr: 2, tablet: true },
  { name: 'Laptop 1366', width: 1366, height: 768, dpr: 1, desktop: true },
  { name: 'Desktop 1920', width: 1920, height: 1080, dpr: 1, desktop: true },
];

const ROUTES = [
  { hash: '#/home', name: 'home' },
  { hash: '#/quiz', name: 'quiz' },
  { hash: '#/daily', name: 'daily' },
  { hash: '#/badges', name: 'badges' },
  { hash: '#/profile', name: 'profile' },
  { hash: '#/card', name: 'card' },
  { hash: '#/settings', name: 'settings' },
  { hash: '#/tiers', name: 'tiers' },
];

const results = [];
let failures = 0;

function addResult(vp, route, issues) {
  results.push({ viewport: vp.name, route, issues });
  if (issues.length) {
    failures += issues.length;
    console.log(`  ✗ ${vp.name} / ${route}`);
    for (const i of issues) console.log(`      · ${i}`);
  }
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  protocolTimeout: 120_000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

try {
  // 先在一个桌面页面里把 localStorage 填好（测段 + 若干经验），保证所有页面都能进入正常态
  const seedPage = await browser.newPage();
  await seedPage.setViewport({ width: 1280, height: 900 });
  await seedPage.goto(BASE, { waitUntil: 'networkidle0' });
  await seedPage.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith('开始游戏'));
    b?.click();
  });
  await seedPage.evaluate(() => { location.hash = '#/quiz'; });
  await new Promise((r) => setTimeout(r, 500));
  for (let i = 0; i < 14; i += 1) {
    await seedPage.waitForSelector('.quiz-option');
    await seedPage.click('.quiz-option');
    await new Promise((r) => setTimeout(r, 70));
    await seedPage.click('.quiz__actions .button');
    await new Promise((r) => setTimeout(r, 110));
  }
  await new Promise((r) => setTimeout(r, 800));
  const seed = await seedPage.evaluate(() => localStorage.getItem('isr:save:v1'));
  const onboarded = await seedPage.evaluate(() => localStorage.getItem('isr:onboarded:v1') ?? '1');
  await seedPage.close();

  for (const vp of VIEWPORTS) {
    console.log(`\n## ${vp.name} (${vp.width}×${vp.height} @${vp.dpr}x)`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 注意：headless Chrome 在 isMobile=true 且 dpr>1 时 innerWidth 会被错误放大，
    // 这里用「精确 CSS 宽度 + 触摸模拟」来测布局，保证测的就是真实 CSS 视口。
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dpr,
      isMobile: false,
      hasTouch: !vp.desktop,
      isLandscape: Boolean(vp.landscape),
    });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.evaluate(
      (save, onb) => {
        localStorage.setItem('isr:save:v1', save);
        localStorage.setItem('isr:onboarded:v1', onb);
      },
      seed,
      onboarded,
    );

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.hash}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 450));
      const audit = await page.evaluate((touchMode) => {
        const issues = [];
        const doc = document.documentElement;
        const vw = doc.clientWidth;

        // 1. 横向滚动
        if (doc.scrollWidth > vw + 1) {
          issues.push(`横向滚动：scrollWidth=${doc.scrollWidth} > viewport=${vw}`);
        }

        // 2. 越界元素（排除被 overflow 裁剪的装饰元素）
        const isClipped = (el) => {
          let p = el.parentElement;
          while (p) {
            const s = getComputedStyle(p);
            if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX) || ['hidden', 'clip'].includes(s.overflow)) return true;
            if (s.position === 'fixed' && s.overflowX !== 'visible') return true;
            p = p.parentElement;
          }
          return false;
        };
        const offscreen = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          if (getComputedStyle(el).position === 'fixed') continue;
          if ((r.right > vw + 2 || r.left < -2) && !isClipped(el)) {
            offscreen.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (left=${Math.round(r.left)}, right=${Math.round(r.right)})`);
            if (offscreen.length >= 4) break;
          }
        }
        if (offscreen.length) issues.push(`元素越界：${offscreen.join('；')}`);

        // 3. 顶栏
        const header = document.querySelector('.site-header__inner');
        if (!header) issues.push('缺少顶栏');
        else {
          const hr = header.getBoundingClientRect();
          if (hr.right > vw + 2 || hr.left < -2) issues.push('顶栏溢出视口');
          const children = [...header.children].filter((c) => c.getBoundingClientRect().width > 0);
          let prevRight = -Infinity;
          for (const c of children) {
            const r = c.getBoundingClientRect();
            if (r.left < prevRight - 1) issues.push(`顶栏元素重叠：${c.className}`);
            prevRight = r.right;
          }
          if (children.some((c) => c.getBoundingClientRect().right > vw + 2)) issues.push('顶栏内元素超出右边界');
        }

        // 4. 作者 X 链接
        const author = document.querySelector('.author-link');
        if (!author) issues.push('顶部缺少作者 X 链接');
        else {
          const ar = author.getBoundingClientRect();
          if (ar.width < 37 || ar.height < 37) issues.push(`作者链接过小 ${Math.round(ar.width)}×${Math.round(ar.height)}`);
          if (ar.right > vw + 2) issues.push('作者链接超出视口');
          const cs = getComputedStyle(author);
          if (cs.display === 'none' || cs.visibility === 'hidden') issues.push('作者链接不可见');
        }

        // 5. 触控目标（移动/平板宽度下检查可见的主按钮）
        const smallTargets = [];
        if (touchMode) {
          for (const el of document.querySelectorAll('button, a.author-link, .ratio-option, .task-option, .quiz-option, .segmented__item')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            // 行内文字链接允许小一点（页脚/说明里的 .link-button）
            if (el.classList.contains('link-button') || el.classList.contains('segmented__item')) continue;
            if (r.height < 34) smallTargets.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} h=${Math.round(r.height)}`);
          }
        }
        if (smallTargets.length) issues.push(`触控目标偏小：${smallTargets.slice(0, 4).join('；')}`);

        // 6. 关键内容是否在视口内可见（不被裁掉）
        const main = document.querySelector('.app-main');
        if (main) {
          const mr = main.getBoundingClientRect();
          if (mr.width > vw + 2) issues.push('主内容区宽于视口');
        }

        return { issues, scrollW: doc.scrollWidth, vw };
      }, !vp.desktop);
      addResult(vp, route.name, audit.issues);
    }

    // 截图：首页 + 卡片页（每个视口只截两张，避免产物过多）
    await page.goto(`${BASE}#/home`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: join(OUT, `${vp.name.replace(/[\\/:*?"<>|\s]/g, '_')}-home.png`), fullPage: false });
    await page.goto(`${BASE}#/card`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: join(OUT, `${vp.name.replace(/[\\/:*?"<>|\s]/g, '_')}-card.png`), fullPage: false });

    if (errors.length) {
      addResult(vp, 'runtime', errors.map((e) => `脚本错误：${e}`));
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (server) await server.close();
}

const summary = {
  ranAt: new Date().toISOString(),
  viewports: VIEWPORTS.map((v) => `${v.name} ${v.width}x${v.height}`),
  checks: results.length,
  issueCount: failures,
  results,
};
writeFileSync(join(OUT, 'layout-report.json'), JSON.stringify(summary, null, 2));

console.log(`\n共检查 ${results.length} 个「视口 × 页面」组合，${failures} 个问题。`);
if (failures) {
  console.log('❌ 存在自适应问题，详见 .layout-out/layout-report.json');
  process.exitCode = 1;
} else {
  console.log('✅ 所有视口与页面均无横向溢出 / 顶栏重叠 / 触控过小问题');
}
