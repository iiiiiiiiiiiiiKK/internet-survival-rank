import { useEffect, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import { useRouter } from '../app/router';
import { BADGES } from '../config/badges';
import { AXES } from '../config/quiz';
import { PLACEMENT_BANDS, getTier } from '../config/tiers';
import { levelProgress, rankSummary, tierProgress } from '../lib/game';
import { RankEmblem, XpBar } from '../components/RankUI';

export function ResultPage({ store }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const save = store.save;
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReveal(true), 560);
    return () => window.clearTimeout(t);
  }, []);

  if (!save.lastQuiz || !save.placed) {
    return (
      <div className="page page--narrow">
        <div className="card empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            ?
          </div>
          <div className="empty-state__title">还没有测试结果</div>
          <p className="empty-state__desc">先完成 14 道题，才能生成你的初始段位。</p>
          <button type="button" className="button button--primary" onClick={() => navigate('quiz')}>
            开始测试
          </button>
        </div>
      </div>
    );
  }

  const quiz = save.lastQuiz;
  const summary = rankSummary(save);
  const tierP = tierProgress(save.xp);
  const levelP = levelProgress(save.xp);
  const tier = getTier(levelP.level.tierId);
  const band = [...PLACEMENT_BANDS].reverse().find((b) => b.minPercent <= quiz.percent) ?? PLACEMENT_BANDS[0];

  return (
    <div className={`page result-page ${reveal ? 'is-revealed' : ''}`}>
      <div className="result-hero">
        <div className="result-hero__scan" aria-hidden="true" />
        <div className="eyebrow">{quiz.placement ? 'PLACEMENT COMPLETE · 首测结算' : 'RETAKE COMPLETE · 重测完成'}</div>
        <h1 className="result-hero__title">
          你的互联网段位是
          <span className="glitch" data-text={summary.levelLabel}>
            {summary.levelLabel}
          </span>
        </h1>
        <p className="result-hero__sub">
          {summary.tierName}「{summary.tierEpithet}」
          {summary.levelTitle !== summary.tierEpithet ? ` · ${summary.levelTitle}` : ''}
        </p>
        <p className="result-hero__tagline">
          {quiz.placement
            ? `首测答对 ${quiz.correctCount}/${quiz.total} 题（${quiz.percent}%），起点由正确率档位决定。`
            : '重测已更新属性与历史成绩，不会重复发放经验。'}
        </p>
        <div className="result-hero__actions">
          <button type="button" className="button button--primary" onClick={() => navigate('daily')}>
            去做今日挑战
          </button>
          <button type="button" className="button button--ghost" onClick={() => navigate('card')}>
            生成段位卡
          </button>
        </div>
      </div>

      <div className="result-grid">
        <section className="card result-card result-card--main">
          <div className="result-card__head">
            <h2>你的段位徽记</h2>
            <span className="pill pill--muted">共 {quiz.total} 题</span>
          </div>

          <div className="result-id">
            <RankEmblem summary={summary} size="lg" />
            <div className="result-id__info">
              <div className="result-id__level">
                {summary.tierName} <span>{['I', 'II', 'III'][summary.step - 1]}</span>
              </div>
              <div className="result-id__title">{summary.levelTitle}</div>
              <p className="result-id__tagline">{tier.tagline}</p>
              <XpBar progress={levelP} compact />
            </div>
          </div>

          <div className="result-card__head result-card__head--spaced">
            <h2>初始属性</h2>
            <span className="muted small">来自选项倾向，不代表能力高低</span>
          </div>
          <div className="result-axes">
            {AXES.map((axis) => {
              const value = quiz.axes[axis.id];
              const pct = Math.round((value / Math.max(1, quiz.total)) * 100);
              const color = axis.id === 'info' ? '#63e6c2' : axis.id === 'social' ? '#ff6b9d' : '#69a6ff';
              return (
                <div className="result-axis" key={axis.id}>
                  <div className="result-axis__head">
                    <span>{axis.name}</span>
                    <strong style={{ color }}>{pct}%</strong>
                  </div>
                  <div className="result-axis__track">
                    <div className="result-axis__fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="result-axis__desc">{axis.desc}</span>
                </div>
              );
            })}
          </div>

          <div className="result-metrics">
            <div className="metric">
              <span className="metric__label">经验值</span>
              <strong className="metric__value">{save.xp}</strong>
              <span className="metric__sub">XP</span>
            </div>
            <div className="metric">
              <span className="metric__label">当前等级</span>
              <strong className="metric__value">{save.levelIndex + 1}</strong>
              <span className="metric__sub">/ 24</span>
            </div>
            <div className="metric">
              <span className="metric__label">下一级还差</span>
              <strong className="metric__value">{levelP.isMax ? 0 : levelP.remaining}</strong>
              <span className="metric__sub">XP</span>
            </div>
            <div className="metric">
              <span className="metric__label">已解锁徽章</span>
              <strong className="metric__value">{save.badges.length}</strong>
              <span className="metric__sub">/ {BADGES.length}</span>
            </div>
          </div>
        </section>

        <aside className="result-side">
          <section className="card result-card">
            <h2>段位进度</h2>
            <div className="result-tier">
              <div className="result-tier__badge" style={{ borderColor: summary.tierColor }}>
                <span style={{ color: summary.tierColor }}>{['I', 'II', 'III'][summary.step - 1]}</span>
              </div>
              <div>
                <div className="result-tier__name">{summary.tierName}</div>
                <div className="muted">{summary.tierEpithet}</div>
                <div className="result-tier__xp">{save.xp} XP</div>
              </div>
            </div>
            <div className="result-tier__bar">
              <div style={{ width: `${tierP.percent}%`, background: `linear-gradient(90deg, ${summary.tierColorDark}, ${summary.tierColor})` }} />
            </div>
            <p className="muted small">
              {levelP.isMax ? '已到达最高等级。' : `距离「${levelP.next?.title}」还差 ${levelP.remaining} XP。`}
            </p>
          </section>

          <section className="card result-card">
            <h2>为什么是这个段位？</h2>
            <p className="muted small">本地规则完全公开，随时可在「段位表」查看。</p>
            <ol className="mini-steps">
              <li>每次从 15 题库随机抽 14 题。</li>
              <li>
                本次正确率 <strong>{quiz.percent}%</strong>，落在「≥ {band.minPercent}%」档位。
              </li>
              <li>首测经验只发一次，重测只更新称号与属性。</li>
            </ol>
            <div className="debug-info">
              起点等级 {levelP.level.index + 1}/24 · 当前累计 {save.xp} XP · 下一门槛 {levelP.next?.minXp ?? 'MAX'}
            </div>
          </section>

          <section className="card result-card">
            <h2>分享结果</h2>
            <p className="muted small">把段位卡存成 1:1 或 3:4 图片，发给朋友。</p>
            <div className="result-side__actions">
              <button type="button" className="button button--primary" onClick={() => navigate('card')}>
                生成段位卡
              </button>
              <button type="button" className="button button--ghost" onClick={() => navigate('profile')}>
                个人主页
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="result-footnote">
        <p>
          娱乐声明：段位、经验和徽章只反映你在本站游戏中的选择，不代表真实能力、智力或人格评估。题库与积分规则公开可查。
        </p>
      </div>
    </div>
  );
}
