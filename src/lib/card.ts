/**
 * 段位卡渲染（Canvas 2D，不依赖第三方库）
 * ------------------------------------------------------------------
 * 输出 1:1 与 3:4 两种比例。渲染函数接收画布尺寸，按比例缩放所有坐标，
 * 因此在任何 DPR 下都清晰；导出为 PNG，并提供文本版复制。
 *
 * 该文件只负责"画"，数据来自 rankSummary()，便于独立测试导出尺寸。
 */

import type { RankSummary } from './game';
import { BADGES } from '../config/badges';
import { SITE } from '../config/site';

export type CardRatio = 'square' | 'tall';

export const CARD_SIZES: Record<CardRatio, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: '1:1 方形' },
  tall: { width: 1080, height: 1440, label: '3:4 竖版' },
};

const FONT_STACK =
  '"Pixel CJK", "Zpix", "Fusion Pixel", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const MONO_STACK =
  '"JetBrains Mono", "SFMono-Regular", Consolas, "Microsoft YaHei", monospace';

function px(ctx: CanvasRenderingContext2D, size: number, weight = 700, family: 'sans' | 'mono' = 'sans') {
  ctx.font = `${weight} ${size}px ${family === 'mono' ? MONO_STACK : FONT_STACK}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 把颜色字符串转成带透明度的 rgba（支持 #rrggbb） */
function alpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** 绘制扫描线背景，制造 CRT 质感 */
function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, gap: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < h; y += gap) {
    ctx.fillRect(0, y, w, Math.max(1, gap / 4));
  }
  ctx.restore();
}

/** 绘制像素网格 */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** 画像素星星（装饰） */
function drawStars(ctx: CanvasRenderingContext2D, w: number, count: number) {
  ctx.save();
  const colors = ['#f5c542', '#63e6c2', '#69a6ff', '#ff6b9d', '#d08a4a'];
  for (let i = 0; i < count; i += 1) {
    const x = Math.round(((i * 137.5) % 100) * (w / 100));
    const y = Math.round(((i * 71.3) % 100) * (w / 100) * 0.55);
    const s = i % 5 === 0 ? 4 : 3;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.25 + (i % 3) * 0.15;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

/** 下载/导出用：返回 dataURL 和尺寸 */
export interface RenderedCard {
  dataUrl: string;
  width: number;
  height: number;
  ratio: CardRatio;
  filename: string;
}

export function renderRankCard(summary: RankSummary, ratio: CardRatio, opts: { now?: Date; nickname?: string } = {}): RenderedCard {
  const { width: w, height: h } = CARD_SIZES[ratio];
  const scale = w / 1080; // 所有尺寸以 1:1 的 1080 为基准
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas 2D，无法生成分享卡。');
  ctx.textBaseline = 'alphabetic';

  const tall = ratio === 'tall';
  const pad = (tall ? 84 : 76) * scale;
  const contentW = w - pad * 2;

  /* ---------- 背景 ---------- */
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#070a14');
  bg.addColorStop(0.55, '#0b1020');
  bg.addColorStop(1, '#070a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 段位色光晕
  const glow = ctx.createRadialGradient(w * 0.82, h * 0.08, 0, w * 0.82, h * 0.08, w * 0.9);
  glow.addColorStop(0, alpha(summary.tierColor, 0.3));
  glow.addColorStop(0.55, alpha(summary.tierColor, 0.07));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, w, h, 45 * scale, 'rgba(255,255,255,0.035)');
  drawStars(ctx, w, 40);
  drawScanlines(ctx, w, h, 6 * scale);

  // 外边框
  ctx.strokeStyle = alpha(summary.tierColor, 0.7);
  ctx.lineWidth = 6 * scale;
  roundRect(ctx, pad * 0.45, pad * 0.45, w - pad * 0.9, h - pad * 0.9, 26 * scale);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2 * scale;
  roundRect(ctx, pad * 0.6, pad * 0.6, w - pad * 1.2, h - pad * 1.2, 22 * scale);
  ctx.stroke();

  /* ---------- 顶栏 ---------- */
  let y = pad * 1.05;
  ctx.textAlign = 'left';
  px(ctx, 26 * scale, 700, 'mono');
  ctx.fillStyle = alpha(summary.tierColor, 0.95);
  ctx.fillText('INTERNET SURVIVAL RANK', pad, y);

  px(ctx, 24 * scale, 500, 'mono');
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'right';
  ctx.fillText('// 娱乐段位，非能力评估', w - pad, y);

  y += 34 * scale;
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(w - pad, y);
  ctx.stroke();

  /* ---------- 主区块：段位徽记 ---------- */
  y += tall ? 92 * scale : 64 * scale;
  const emblemSize = (tall ? 300 : 250) * scale;
  const emblemX = w / 2;
  const emblemY = y + emblemSize / 2;
  drawEmblem(ctx, emblemX, emblemY, emblemSize, summary, scale);

  y = emblemY + emblemSize / 2 + (tall ? 74 : 56) * scale;

  /* ---------- 段位名 ---------- */
  ctx.textAlign = 'center';
  px(ctx, 32 * scale, 600, 'mono');
  ctx.fillStyle = alpha(summary.tierColor, 0.9);
  ctx.fillText(`${summary.tierName.toUpperCase()} · ${summary.levelLabel}`, w / 2, y);
  y += (tall ? 92 : 78) * scale;

  px(ctx, 78 * scale, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(summary.levelTitle, w / 2, y);
  y += (tall ? 58 : 50) * scale;

  px(ctx, 34 * scale, 500);
  ctx.fillStyle = 'rgba(226,235,255,0.62)';
  ctx.fillText(summary.tierEpithet, w / 2, y);
  y += (tall ? 78 : 62) * scale;

  /* ---------- 经验条 ---------- */
  const barW = contentW;
  const barH = 30 * scale;
  const barX = pad;
  const barY = y;
  ctx.textAlign = 'left';
  px(ctx, 26 * scale, 600, 'mono');
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('XP', barX, barY - 16 * scale);
  ctx.textAlign = 'right';
  ctx.fillStyle = alpha(summary.tierColor, 0.95);
  ctx.fillText(`${summary.xp.toLocaleString('en-US')} XP`, barX + barW, barY - 16 * scale);

  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillW = Math.max(barH, (barW * summary.percent) / 100);
  roundRect(ctx, barX, barY, summary.isMax ? barW : fillW, barH, barH / 2);
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0, summary.tierColorDark);
  barGrad.addColorStop(1, summary.tierColor);
  ctx.fillStyle = barGrad;
  ctx.fill();
  // 方块刻度
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  for (let gx = barX + barH; gx < barX + barW; gx += 24 * scale) {
    ctx.fillRect(gx, barY + 4 * scale, 2 * scale, barH - 8 * scale);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  px(ctx, 24 * scale, 500, 'mono');
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(summary.isMax ? 'MAX LEVEL' : `NEXT · ${summary.nextTitle ?? '—'} · 还差 ${summary.remaining} XP`, barX, barY + barH + 38 * scale);

  y = barY + barH + (tall ? 96 : 76) * scale;

  /* ---------- 三维属性 ---------- */
  const axes: { key: 'info' | 'social' | 'vibe'; name: string; color: string }[] = [
    { key: 'info', name: '信息雷达', color: '#63e6c2' },
    { key: 'social', name: '社交电量', color: '#ff6b9d' },
    { key: 'vibe', name: '赛博松弛', color: '#69a6ff' },
  ];
  const axisGap = 22 * scale;
  const axisColW = (contentW - axisGap * 2) / 3;
  axes.forEach((axis, i) => {
    const ax = pad + i * (axisColW + axisGap);
    const value = summary.axes[axis.key];
    ctx.textAlign = 'left';
    px(ctx, 24 * scale, 600, 'mono');
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(axis.name, ax, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = axis.color;
    ctx.fillText(`${value}`, ax + axisColW, y);
    ctx.textAlign = 'left';
    const mbY = y + 16 * scale;
    roundRect(ctx, ax, mbY, axisColW, 12 * scale, 6 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    roundRect(ctx, ax, mbY, (axisColW * value) / 100, 12 * scale, 6 * scale);
    ctx.fillStyle = axis.color;
    ctx.fill();
  });
  y += (tall ? 82 : 66) * scale;

  /* ---------- 数据条 ---------- */
  const stats = [
    { label: '徽章', value: `${summary.badgeCount}/${BADGES.length}` },
    { label: '连续挑战', value: `${summary.streak} 天` },
    { label: '完成任务', value: `${summary.tasksDone}` },
    { label: '主属性', value: summary.dominantLabel },
  ];
  const statGap = 16 * scale;
  const statW = (contentW - statGap * (stats.length - 1)) / stats.length;
  const statH = (tall ? 118 : 96) * scale;
  stats.forEach((stat, i) => {
    const sx = pad + i * (statW + statGap);
    roundRect(ctx, sx, y, statW, statH, 14 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.textAlign = 'center';
    px(ctx, (stat.value.length > 6 ? 26 : 34) * scale, 700);
    ctx.fillStyle = '#e9f0ff';
    ctx.fillText(stat.value, sx + statW / 2, y + statH * 0.52);
    px(ctx, 20 * scale, 500, 'mono');
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText(stat.label, sx + statW / 2, y + statH * 0.8);
  });

  /* ---------- 页脚 ---------- */
  const footerY = h - pad * 0.95;
  ctx.textAlign = 'left';
  px(ctx, 22 * scale, 500, 'mono');
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  const dateText = (opts.now ?? new Date()).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  ctx.fillText(`ISSUED ${dateText}`, pad, footerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  px(ctx, 22 * scale, 600, 'mono');
  ctx.fillText('本地生成 · 不上传', w - pad, footerY);

  if (opts.nickname) {
    ctx.textAlign = 'center';
    px(ctx, 24 * scale, 600);
    ctx.fillStyle = alpha(summary.tierColor, 0.85);
    ctx.fillText(`@${opts.nickname}`, w / 2, h - pad * 1.75);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: w,
    height: h,
    ratio,
    filename: `互联网生存段位-${summary.tierName}-${summary.levelLabel.replace(/\s/g, '')}-${ratio === 'square' ? '1x1' : '3x4'}.png`,
  };
}

/** 段位徽记：六边形 + 像素环，不使用任何现有游戏资产 */
function drawEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, summary: RankSummary, scale: number) {
  const r = size / 2;
  ctx.save();

  // 外发光
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.45);
  glow.addColorStop(0, alpha(summary.tierColor, 0.35));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
  ctx.fill();

  // 像素外环（8 段）
  const outerR = r * 1.08;
  for (let i = 0; i < 8; i += 1) {
    const a0 = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = alpha(summary.tierColor, i % 2 === 0 ? 0.85 : 0.3);
    ctx.lineWidth = 8 * scale;
    ctx.arc(cx, cy, outerR, a0 + 0.08, a0 + (Math.PI * 2) / 8 - 0.08);
    ctx.stroke();
  }

  // 六边形主体
  const hex = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  const hexGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  hexGrad.addColorStop(0, summary.tierColorDark);
  hexGrad.addColorStop(0.55, summary.tierColor);
  hexGrad.addColorStop(1, summary.tierColorDark);
  hex(r * 0.86);
  ctx.fillStyle = hexGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 10 * scale;
  ctx.stroke();

  // 内部深色圆
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.64, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7,10,20,0.82)';
  ctx.fill();
  ctx.strokeStyle = alpha(summary.tierColor, 0.8);
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  // 中心罗马数字
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  px(ctx, r * 0.62, 800, 'mono');
  ctx.fillStyle = '#f4f8ff';
  ctx.shadowColor = summary.tierColor;
  ctx.shadowBlur = 24 * scale;
  const roman = ['I', 'II', 'III'][Math.max(0, Math.min(2, summary.step - 1))];
  ctx.fillText(roman, cx, cy + r * 0.02);
  ctx.shadowBlur = 0;

  // 顶部小字
  px(ctx, 22 * scale, 600, 'mono');
  ctx.fillStyle = alpha(summary.tierColor, 0.95);
  ctx.fillText(summary.tierName, cx, cy + r * 0.42);

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/** 文本版分享内容（无法下载图片时可复制） */
export function cardText(summary: RankSummary, nickname?: string): string {
  const name = nickname ? `@${nickname}\n` : '';
  return [
    `【${SITE.name}】${name}${summary.levelLabel} · ${summary.levelTitle}`,
    `段位：${summary.tierName}「${summary.tierEpithet}」`,
    `经验：${summary.xp} XP（当前等级 ${summary.percent}%）`,
    `徽章：${summary.badgeCount}/${BADGES.length}　连续挑战：${summary.streak} 天　完成任务：${summary.tasksDone}`,
    `属性：信息雷达 ${summary.axes.info} / 社交电量 ${summary.axes.social} / 赛博松弛 ${summary.axes.vibe}`,
    '',
    SITE.disclaimer,
  ].join('\n');
}
