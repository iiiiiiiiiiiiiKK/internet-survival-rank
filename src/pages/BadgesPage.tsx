import { useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import { BADGES, BADGE_CATEGORY_LABEL, RARITY_LABEL, type BadgeCategory } from '../config/badges';
import { badgeProgress } from '../lib/game';
import { PageHeader } from '../components/Layout';
import { useRouter } from '../app/router';

const CATEGORIES: { id: BadgeCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  ...(Object.keys(BADGE_CATEGORY_LABEL) as BadgeCategory[]).map((id) => ({ id, label: BADGE_CATEGORY_LABEL[id] })),
];

export function BadgesPage({ store }: { store: GameStore }) {
  const { navigate } = useRouter();
  const save = store.save;
  const [category, setCategory] = useState<BadgeCategory | 'all'>('all');
  const [onlyLocked, setOnlyLocked] = useState(false);

  const owned = new Set(save.badges.map((b) => b.id));
  const list = BADGES.filter((b) => (category === 'all' || b.category === category) && (!onlyLocked || !owned.has(b.id)));
  const ownedCount = BADGES.length - BADGES.filter((b) => !owned.has(b.id)).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="COLLECTION"
        title="徽章收藏"
        desc={`${BADGES.length} 枚徽章，全部按本地条件自动解锁。已解锁 ${ownedCount} 枚${ownedCount === BADGES.length ? '，全部集齐！' : '。'}`}
        actions={
          <button type="button" className="button button--ghost" onClick={() => navigate('profile')}>
            返回个人主页
          </button>
        }
      />

      <div className="badge-toolbar">
        <div className="segmented" role="tablist" aria-label="按类别筛选">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={`segmented__item ${category === c.id ? 'is-active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={onlyLocked} onChange={(e) => setOnlyLocked(e.target.checked)} />
          <span className="switch__track" aria-hidden="true" />
          <span>只看未解锁</span>
        </label>
      </div>

      <div className="badge-count">
        <span>显示 {list.length} 枚</span>
        <span>·</span>
        <span>已解锁 {ownedCount}/{BADGES.length}</span>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            🏅
          </div>
          <div className="empty-state__title">这个分类的徽章全部集齐了</div>
          <p className="empty-state__desc">去每日挑战继续攒经验，或者看看别的分类。</p>
        </div>
      ) : (
        <div className="badge-grid">
          {list.map((badge) => {
            const progress = badgeProgress(save, badge);
            const unlocked = progress.unlocked;
            return (
              <article key={badge.id} className={`badge-card badge-card--${badge.rarity} ${unlocked ? 'is-unlocked' : 'is-locked'}`}>
                <div className="badge-card__top">
                  <span className="badge-card__icon" aria-hidden="true">
                    {unlocked ? badge.icon : '🔒'}
                  </span>
                  <span className={`badge-card__rarity badge-card__rarity--${badge.rarity}`}>{RARITY_LABEL[badge.rarity]}</span>
                </div>
                <h3 className="badge-card__name">{unlocked ? badge.name : '???'}</h3>
                <p className="badge-card__desc">{unlocked ? badge.desc : badge.hint}</p>
                <div className="badge-card__progress" aria-hidden="true">
                  <div className="badge-card__progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="badge-card__meta">
                  <span>{BADGE_CATEGORY_LABEL[badge.category]}</span>
                  <span>
                    {unlocked ? '已解锁' : `${Math.min(progress.current, badge.gte)}/${badge.gte}`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="disclaimer-line">
        徽章只记录你在本游戏里的行为，不构成任何真实能力、身份或消费能力的证明。
      </p>
    </div>
  );
}
