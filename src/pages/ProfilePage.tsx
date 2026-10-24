import { useMemo, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import { useRouter } from '../app/router';
import { BADGES, BADGE_MAP, BADGE_CATEGORY_LABEL } from '../config/badges';
import { ECONOMY } from '../config/economy';
import { TIERS } from '../config/tiers';
import {
  badgeCountByCategory,
  levelProgress,
  rankSummary,
  tierProgress,
  xpEarnedOn,
} from '../lib/game';
import { AxisBars, RankEmblem, XpBar } from '../components/RankUI';
import { PageHeader } from '../components/Layout';

export function ProfilePage({ store, notify }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const save = store.save;
  const [nameDraft, setNameDraft] = useState(save.nickname);
  const [editingName, setEditingName] = useState(false);
  const summary = useMemo(() => rankSummary(save), [save]);
  const progress = levelProgress(save.xp);
  const tierP = tierProgress(save.xp);
  const categoryCounts = badgeCountByCategory(save);
  const todayEarned = save.today ? xpEarnedOn(save, save.today.date) : 0;

  const history = save.quizHistory;
  const recentDays = [...save.history, ...(save.today ? [save.today] : [])]
    .filter((d, i, arr) => arr.findIndex((x) => x.date === d.date) === i)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14);

  function saveName() {
    const clean = Array.from(nameDraft.trim()).slice(0, 12).join('');
    store.setSave((prev) => ({ ...prev, nickname: clean }));
    setNameDraft(clean);
    setEditingName(false);
    notify({ kind: 'info', title: clean ? '昵称已保存' : '已清空昵称', detail: '昵称只保存在本地，会出现在段位卡上。' });
  }

  return (
    <div className="page profile">
      <PageHeader
        eyebrow="PLAYER PROFILE"
        title="个人主页"
        desc="段位、徽章、历史成绩都来自这台设备上的本地存档。"
        actions={
          <>
            <button type="button" className="button button--primary" onClick={() => navigate('card')}>
              生成段位卡
            </button>
            <button type="button" className="button button--ghost" onClick={() => navigate('settings')}>
              数据与设置
            </button>
          </>
        }
      />

      <div className="profile-grid">
        <section className="profile-id card">
          <div className="profile-id__banner" style={{ background: `linear-gradient(135deg, ${summary.tierColorDark}, transparent 70%)` }} aria-hidden="true" />
          <div className="profile-id__body">
            <RankEmblem summary={summary} size="md" />
            <div className="profile-id__main">
              {editingName ? (
                <div className="name-edit">
                  <input
                    className="input"
                    value={nameDraft}
                    maxLength={12}
                    placeholder="给自己起个赛博昵称（可选）"
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    aria-label="赛博昵称"
                    autoFocus
                  />
                  <button type="button" className="button button--small button--primary" onClick={saveName}>
                    保存
                  </button>
                  <button
                    type="button"
                    className="button button--small button--ghost"
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(save.nickname);
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button type="button" className="profile-id__name" onClick={() => setEditingName(true)} title="点击编辑昵称">
                  {save.nickname || '未命名冲浪者'} <span className="profile-id__edit">✎</span>
                </button>
              )}
              <div className="profile-id__rank">
                <span style={{ color: summary.tierColor }}>{summary.levelLabel}</span>
                <span className="profile-id__epithet">{summary.tierEpithet}</span>
              </div>
              <div className="profile-id__chips">
                <span className="pill">LV.{progress.level.index + 1}/24</span>
                <span className="pill pill--muted">{save.xp} XP</span>
                <span className="pill pill--muted">{summary.dominantLabel}</span>
              </div>
            </div>
          </div>

          <XpBar progress={progress} />

          <div className="profile-id__stats">
            <div>
              <strong>{save.stats.tasksCompleted}</strong>
              <span>完成任务</span>
            </div>
            <div>
              <strong>{save.stats.currentStreak}</strong>
              <span>连续天数</span>
            </div>
            <div>
              <strong>{save.badges.length}</strong>
              <span>徽章</span>
            </div>
            <div>
              <strong>{todayEarned}</strong>
              <span>今日经验</span>
            </div>
          </div>
        </section>

        <section className="card profile-axes">
          <div className="result-card__head">
            <h2>互联网属性</h2>
            <span className="muted small">由最近一次测试生成</span>
          </div>
          <AxisBars axes={summary.axes} />
          <p className="muted small">
            属性只描述你在测试中的选择倾向：信息雷达管「查证」，社交电量管「表达」，赛博松弛管「边界」。
          </p>
        </section>

        <section className="card profile-tier">
          <div className="result-card__head">
            <h2>段位路径</h2>
            <span className="muted small">{summary.tierName} 进度 {tierP.percent}%</span>
          </div>
          <div className="mini-tier-path">
            {TIERS.map((tier) => {
              const current = tier.id === tierP.tier;
              const reached = save.xp >= tier.thresholds[0];
              const hidden = Boolean(tier.hidden) && !reached;
              return (
                <div key={tier.id} className={`mini-tier ${current ? 'is-current' : ''} ${reached ? 'is-reached' : ''}`}>
                  <span className="mini-tier__dot" style={{ background: hidden ? '#2a3144' : tier.color }} aria-hidden="true" />
                  <span className="mini-tier__name">{hidden ? '???' : tier.name}</span>
                  <span className="mini-tier__xp">{hidden ? '???' : tier.thresholds[0]}</span>
                </div>
              );
            })}
          </div>
          <button type="button" className="link-button" onClick={() => navigate('tiers')}>
            查看完整段位表与规则 →
          </button>
        </section>

        <section className="card profile-badges">
          <div className="result-card__head">
            <h2>徽章进度</h2>
            <button type="button" className="link-button" onClick={() => navigate('badges')}>
              全部徽章 →
            </button>
          </div>
          <div className="badge-mini-grid">
            {BADGES.filter((b) => save.badges.some((x) => x.id === b.id))
              .slice(-8)
              .reverse()
              .map((b) => (
                <div key={b.id} className="badge-mini" title={`${b.name} · ${b.desc}`}>
                  <span aria-hidden="true">{b.icon}</span>
                  <span>{b.name}</span>
                </div>
              ))}
            {save.badges.length === 0 && <p className="muted">还没有徽章。完成首测与每日任务就会开始解锁。</p>}
          </div>
          <div className="category-counts">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <span key={cat} className="pill pill--muted">
                {BADGE_CATEGORY_LABEL[cat as keyof typeof BADGE_CATEGORY_LABEL] ?? cat} {count.owned}/{count.total}
              </span>
            ))}
          </div>
        </section>

        <section className="card profile-history">
          <div className="result-card__head">
            <h2>历史成绩</h2>
            <span className="muted small">最近 {Math.min(history.length, 20)} 次测试</span>
          </div>
          {history.length === 0 ? (
            <p className="muted">还没有历史记录。</p>
          ) : (
            <div className="history-table" role="table" aria-label="测试历史">
              <div className="history-table__head" role="row">
                <span role="columnheader">日期</span>
                <span role="columnheader">正确率</span>
                <span role="columnheader">起点</span>
                <span role="columnheader">类型</span>
              </div>
              {history.slice(0, 8).map((h) => (
                <div className="history-table__row" role="row" key={`${h.at}-${h.date}`}>
                  <span role="cell">{new Date(h.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span role="cell">
                    {h.correctCount}/{h.total} · {h.percent}%
                  </span>
                  <span role="cell">{tierLabel(h.levelIndex)}</span>
                  <span role="cell">{h.placement ? '首测' : '重测'}</span>
                </div>
              ))}
            </div>
          )}
          <div className="history-days">
            <h3>最近 14 天任务</h3>
            <div className="day-dots">
              {recentDays.length === 0 && <span className="muted">暂无记录</span>}
              {recentDays.map((d) => {
                const full = d.done.length >= d.tasks.length && d.tasks.length > 0;
                return (
                  <span
                    key={d.date}
                    className={`day-dot ${full ? 'is-full' : d.done.length > 0 ? 'is-partial' : ''}`}
                    title={`${d.date} · 完成 ${d.done.length}/${d.tasks.length}`}
                  >
                    {d.date.slice(5)}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card profile-quick">
          <h2>快捷操作</h2>
          <div className="quick-actions">
            <button type="button" className="button button--ghost" onClick={() => navigate('quiz')}>
              重新测试（不加经验）
            </button>
            <button type="button" className="button button--ghost" onClick={() => navigate('badges')}>
              徽章收藏
            </button>
            <button type="button" className="button button--ghost" onClick={() => navigate('settings')}>
              导出 / 导入进度
            </button>
          </div>
          <p className="muted small">{ECONOMY.retakeNote} 当前已重测 {save.stats.quizRetakes} 次。</p>
          <div className="unlock-latest">
            {save.badges.length > 0 && (
              <>
                <span className="muted small">最近解锁：</span>
                <span>
                  {BADGE_MAP[save.badges[save.badges.length - 1].id]?.icon}{' '}
                  {BADGE_MAP[save.badges[save.badges.length - 1].id]?.name ?? '未知徽章'}
                </span>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function tierLabel(levelIndex: number): string {
  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor(levelIndex / 3))];
  const roman = ['I', 'II', 'III'][levelIndex % 3];
  return `${tier.name} ${roman}`;
}
