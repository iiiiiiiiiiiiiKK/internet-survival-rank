import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import { useRouter } from '../app/router';
import { BADGES, BADGE_MAP } from '../config/badges';
import { CARD_SIZES, cardText, renderRankCard, type CardRatio } from '../lib/card';
import { rankSummary, touchStat } from '../lib/game';
import { PageHeader } from '../components/Layout';

export function CardPage({ store, notify }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const save = store.save;
  const summary = useMemo(() => rankSummary(save), [save]);
  const [ratio, setRatio] = useState<CardRatio>('square');
  const [preview, setPreview] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 预览：用同一套 Canvas 渲染，缩小显示；窗口变化时重绘
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      try {
        const rendered = renderRankCard(summary, ratio, { nickname: save.nickname.trim() || undefined });
        if (!cancelled) {
          setPreview(rendered.dataUrl);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '生成失败');
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', draw);
    };
  }, [summary, ratio, save.nickname]);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const rendered = renderRankCard(summary, ratio, { nickname: save.nickname.trim() || undefined });
      const link = document.createElement('a');
      link.href = rendered.dataUrl;
      link.download = rendered.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      store.setSave((prev) => touchStat(prev, ratio === 'square' ? 'sharesSquare' : 'sharesTall').save);
      notify({ kind: 'info', title: '段位卡已导出', detail: `${rendered.width}×${rendered.height} PNG · 文件名 ${rendered.filename}` });
      store.flush();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
      notify({ kind: 'warn', title: '导出失败', detail: '浏览器可能禁止了下载，请长按预览图保存。' });
    } finally {
      window.setTimeout(() => setBusy(false), 500);
    }
  }

  async function copyText() {
    const text = cardText(summary, save.nickname.trim() || undefined);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      // 某些浏览器（含无头环境）可能让 writeText 长时间不 resolve，加超时兜底
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('clipboard timeout')), 1500)),
      ]);
      store.setSave((prev) => touchStat(prev, ratio === 'square' ? 'sharesSquare' : 'sharesTall').save);
      notify({ kind: 'info', title: '分享文案已复制' });
    } catch {
      // 降级：用隐藏 textarea + execCommand（旧浏览器/无权限时）
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand?.('copy') ?? false;
      ta.remove();
      if (ok) {
        store.setSave((prev) => touchStat(prev, ratio === 'square' ? 'sharesSquare' : 'sharesTall').save);
        notify({ kind: 'info', title: '分享文案已复制' });
      } else {
        setFallbackText(text);
        notify({ kind: 'warn', title: '浏览器未授权剪贴板', detail: '已为你展开可手动复制的文案。' });
      }
    }
  }

  const unlockedBadges = save.badges.map((b) => BADGE_MAP[b.id]).filter(Boolean);

  return (
    <div className="page card-page">
      <PageHeader
        eyebrow="RANK CARD"
        title="生成你的段位卡"
        desc="1:1 适合发动态，3:4 适合发故事。图片在你的设备上生成，不会上传任何数据。"
        actions={
          <button type="button" className="button button--ghost" onClick={() => navigate('profile')}>
            返回个人主页
          </button>
        }
      />

      <div className="card-layout">
        <div className="card-preview-wrap">
          <div className={`card-preview card-preview--${ratio}`} ref={previewRef}>
            {error ? (
              <div className="card-preview__error">
                <strong>无法生成预览</strong>
                <p>{error}</p>
              </div>
            ) : preview ? (
              <img src={preview} alt={`${summary.levelLabel} 段位卡预览`} className="card-preview__img" />
            ) : (
              <div className="card-preview__loading">正在绘制…</div>
            )}
          </div>
          <div className="card-preview__hint">预览为压缩显示，下载得到 {CARD_SIZES[ratio].width}×{CARD_SIZES[ratio].height} 的 PNG。</div>
        </div>

        <div className="card-controls">
          <section className="card">
            <h2>比例</h2>
            <div className="ratio-options" role="radiogroup" aria-label="选择段位卡比例">
              {(Object.keys(CARD_SIZES) as CardRatio[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={ratio === key}
                  className={`ratio-option ${ratio === key ? 'is-active' : ''}`}
                  onClick={() => setRatio(key)}
                >
                  <span className={`ratio-option__shape ratio-option__shape--${key}`} aria-hidden="true" />
                  <span className="ratio-option__label">{CARD_SIZES[key].label}</span>
                  <span className="ratio-option__size">
                    {CARD_SIZES[key].width}×{CARD_SIZES[key].height}
                  </span>
                </button>
              ))}
            </div>

            <div className="card-actions">
              <button type="button" className="button button--primary button--wide" onClick={download} disabled={busy || Boolean(error)}>
                {busy ? '正在导出…' : `下载 ${CARD_SIZES[ratio].label} PNG`}
              </button>
              <button type="button" className="button button--ghost button--wide" onClick={copyText}>
                复制分享文案
              </button>
            </div>
            <p className="muted small">
              提示：部分浏览器会拦截自动下载，若没有反应，长按预览图保存即可。
            </p>
            {fallbackText && (
              <div className="copy-fallback">
                <label className="copy-fallback__label" htmlFor="share-text">
                  手动复制区（全选后复制）
                </label>
                <textarea id="share-text" className="copy-fallback__area" readOnly value={fallbackText} rows={8} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="link-button" onClick={() => setFallbackText(null)}>
                  收起
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>会出现在卡上的信息</h2>
            <ul className="card-checklist">
              <li>{summary.levelLabel} · {summary.levelTitle}</li>
              <li>{save.xp} XP · 当前等级进度 {summary.percent}%</li>
              <li>三维属性与主属性：{summary.dominantLabel}</li>
              <li>徽章 {save.badges.length}/{BADGES.length} · 连续 {save.stats.currentStreak} 天</li>
              <li>{save.nickname ? `昵称 @${save.nickname}` : '未设置昵称（可在个人主页设置）'}</li>
            </ul>
            <p className="muted small">
              没有真实姓名、手机号、头像或位置信息；昵称完全可选，只存在本地。
            </p>
          </section>

          <section className="card">
            <h2>最近徽章</h2>
            {unlockedBadges.length === 0 ? (
              <p className="muted">还没有徽章。去完成首测和每日挑战吧。</p>
            ) : (
              <div className="card-badges">
                {unlockedBadges.slice(-6).map((badge) => (
                  <span key={badge.id} className="card-badge" title={badge.desc}>
                    <span aria-hidden="true">{badge.icon}</span> {badge.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="card-disclaimer">
        这张卡片是娱乐性质的游戏成绩单，不代表真实能力评估。卡片在你的浏览器内绘制，未上传到任何服务器。
      </div>
    </div>
  );
}
