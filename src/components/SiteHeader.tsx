import { useEffect, useState } from 'react';
import { useRouter } from '../app/router';
import type { GameStore } from '../hooks/useGameStore';
import { levelProgress } from '../lib/game';
import { SITE } from '../config/site';

const NAV: { route: 'home' | 'daily' | 'badges' | 'profile' | 'tiers'; label: string; icon: string }[] = [
  { route: 'home', label: '首页', icon: '⌂' },
  { route: 'daily', label: '每日挑战', icon: '☀' },
  { route: 'badges', label: '徽章', icon: '🏅' },
  { route: 'profile', label: '个人', icon: '👤' },
  { route: 'tiers', label: '段位表', icon: '🗺' },
];

export function SiteHeader({ store }: { store: GameStore }) {
  const { route, navigate } = useRouter();
  const progress = levelProgress(store.save.xp);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  const todayDone = store.save.today?.done.length ?? 0;
  const todayTotal = store.save.today?.tasks.length ?? 3;

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button type="button" className="brand" onClick={() => navigate('home')} aria-label={`${SITE.name} 首页`}>
          <span className="brand__mark" aria-hidden="true">
            ◈
          </span>
          <span className="brand__text">
            <span className="brand__zh">{SITE.name}</span>
            <span className="brand__en">{SITE.enName}</span>
          </span>
        </button>

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="主导航">
          {NAV.map((item) => {
            const locked = !store.save.placed && item.route !== 'home' && item.route !== 'tiers';
            return (
              <button
                key={item.route}
                type="button"
                className={`site-nav__item ${route === item.route ? 'is-active' : ''}`}
                aria-current={route === item.route ? 'page' : undefined}
                onClick={() => {
                  if (locked) {
                    navigate('quiz');
                    return;
                  }
                  navigate(item.route);
                }}
              >
                <span className="site-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.route === 'daily' && store.save.placed && (
                  <span className="site-nav__badge" aria-label={`今日已完成 ${todayDone}/${todayTotal}`}>
                    {todayDone}/{todayTotal}
                  </span>
                )}
                {locked && (
                  <span className="site-nav__lock" aria-hidden="true">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="site-header__status">
          <a
            className="author-link"
            href="https://x.com/0xkillcoin"
            target="_blank"
            rel="noopener noreferrer"
            title="作者：@0xkillcoin（在新标签页打开 X）"
            aria-label="作者 @0xkillcoin 的 X 主页（新标签页打开）"
          >
            <span className="author-link__glyph" aria-hidden="true">𝕏</span>
            <span className="author-link__handle" aria-hidden="true">@0xkillcoin</span>
          </a>
          {store.save.placed ? (
            <button type="button" className="rank-chip" onClick={() => navigate('profile')} title="查看个人主页">
              <span className="rank-chip__dot" style={{ background: progress.tier.color }} aria-hidden="true" />
              <span className="rank-chip__label">{progress.level.title}</span>
              <span className="rank-chip__xp">{store.save.xp} XP</span>
            </button>
          ) : (
            <span className="rank-chip rank-chip--empty">未测段</span>
          )}
          <button
            type="button"
            className="icon-button menu-button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="切换导航菜单"
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
