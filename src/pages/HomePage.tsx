import { useMemo, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import { useRouter } from '../app/router';
import { BADGES } from '../config/badges';
import { ECONOMY } from '../config/economy';
import { TIERS, type TierId } from '../config/tiers';
import { levelProgress, rankSummary } from '../lib/game';
import { RankEmblem, XpBar } from '../components/RankUI';

const TIER_ORDER: TierId[] = TIERS.map((t) => t.id);

export function HomePage({ store }: { store: GameStore }) {
  const { navigate } = useRouter();
  const save = store.save;
  const summary = useMemo(() => rankSummary(save), [save]);
  const progress = useMemo(() => levelProgress(save.xp), [save.xp]);
  const [quickOpen, setQuickOpen] = useState(false);

  const today = save.today;
  const todayDone = today?.done.length ?? 0;
  const todayTotal = today?.tasks.length ?? ECONOMY.dailyTaskCount;

  return (
    <div className="page home">
      <section className={`hero ${save.placed ? 'hero--player' : 'hero--new'}`}>
        <div className="hero__bg" aria-hidden="true">
          <div className="hero__grid" />
          <div className="hero__scan" />
          <div className="hero__pixels">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 61) % 100}%`,
                  animationDelay: `${(i * 0.13).toFixed(2)}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="hero__inner">
          <div className="hero__copy">
            <div className="eyebrow">
              INTERNET SURVIVAL RANK <span className="eyebrow__sep">/</span> v1.0 · 纯本地
            </div>
            {save.placed ? (
              <>
                <h1 className="hero__title">
                  欢迎回来，<span className="accent">{summary.levelTitle}</span>
                </h1>
                <p className="hero__desc">
                  {summary.tierName}「{summary.tierEpithet}」 · {save.xp} XP
                </p>
                <XpBar progress={progress} />
                <div className="hero__actions">
                  <button type="button" className="button button--primary button--lg" onClick={() => navigate('daily')}>
                    开始今日挑战
                    <span className="button__badge">
                      {todayDone}/{todayTotal}
                    </span>
                  </button>
                  <button type="button" className="button button--ghost button--lg" onClick={() => navigate('profile')}>
                    个人主页
                  </button>
                  <button type="button" className="button button--ghost button--lg" onClick={() => navigate('card')}>
                    段位卡
                  </button>
                </div>
                <div className="hero__meta">
                  <span>🔥 连续 {save.stats.currentStreak} 天</span>
                  <span>🏅 徽章 {save.badges.length}/{BADGES.length}</span>
                  <span>✅ 累计任务 {save.stats.tasksCompleted}</span>
                </div>
              </>
            ) : (
              <>
                <h1 className="hero__title">
                  你能在互联网
                  <br />
                  活到第几<span className="accent">段</span>？
                </h1>
                <p className="hero__desc">
                  14 道情景选择题，测出你的初始段位。之后每天 3 个轻量挑战，决定你能爬多高。
                </p>
                <div className="hero__actions">
                  <button type="button" className="button button--primary button--lg" onClick={() => navigate('quiz')}>
                    开始段位测试
                    <span className="button__arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                  <button type="button" className="button button--ghost button--lg" onClick={() => navigate('tiers')}>
                    先看段位表
                  </button>
                </div>
                <div className="hero__meta">
                  <span>⏱ 约 3 分钟</span>
                  <span>🧩 8 段位 × 3 级</span>
                  <span>🔒 无需注册</span>
                </div>
              </>
            )}
          </div>

          <div className="hero__visual">
            {save.placed ? (
              <RankEmblem summary={summary} size="lg" />
            ) : (
              <div className="hero__placeholder" aria-hidden="true">
                <div className="hero__placeholder-ring" />
                <div className="hero__placeholder-inner">
                  <span className="hero__placeholder-q">?</span>
                  <span>UNRANKED</span>
                </div>
              </div>
            )}
            <div className="hero__visual-caption">
              {save.placed ? `${summary.tierName} · ${summary.tierEpithet}` : '完成首测后解锁你的徽记'}
            </div>
          </div>
        </div>
      </section>

      {save.placed && today && (
        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">今日挑战</h2>
              <p className="section__desc">{today.date} · 每天 00:00（设备本地时间）刷新，刷新页面不会重新抽题</p>
            </div>
            <button type="button" className="link-button" onClick={() => navigate('daily')}>
              查看全部 →
            </button>
          </div>
          <div className="home-tasks">
            {today.tasks.map((task) => {
              const done = today.done.includes(task.id);
              return (
                <article key={task.id} className={`home-task ${done ? 'is-done' : ''}`}>
                  <div className="home-task__glyph" aria-hidden="true">
                    {task.glyph}
                  </div>
                  <div className="home-task__body">
                    <div className="home-task__title">{task.title}</div>
                    <div className="home-task__desc">{task.desc}</div>
                    <div className="home-task__meta">
                      <span className="pill pill--muted">+{task.xp} XP</span>
                      <span className={`pill ${done ? 'pill--good' : 'pill--warn'}`}>{done ? '已结算' : '未完成'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button button--small button--ghost"
                    onClick={() => navigate('daily')}
                    disabled={done}
                  >
                    {done ? '已完成' : '去挑战'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <div>
            <h2 className="section__title">怎么玩</h2>
            <p className="section__desc">三分钟上手，一辈子（大概）爬不完。</p>
          </div>
        </div>
        <div className="how-grid">
          <div className="how-card">
            <div className="how-card__step">01</div>
            <h3>完成首测</h3>
            <p>14 道互联网生存情景题，答得越稳，起点段位越高。测试结果会生成三维属性。</p>
          </div>
          <div className="how-card">
            <div className="how-card__step">02</div>
            <h3>每日挑战</h3>
            <p>每天 3 个轻量任务：行为选择、单题判断、手速反应或离线计时。每个任务每天只结算一次。</p>
          </div>
          <div className="how-card">
            <div className="how-card__step">03</div>
            <h3>爬段位 · 收徽章</h3>
            <p>经验值跨过门槛就升级。{BADGES.length} 枚徽章记录你的选择，还有 1 个隐藏段位等你发现。</p>
          </div>
          <div className="how-card">
            <div className="how-card__step">04</div>
            <h3>生成段位卡</h3>
            <p>把你现在的段位导出成 1:1 或 3:4 的图片，适合截图和分享。所有数据只在你本地。</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2 className="section__title">段位阶梯</h2>
            <p className="section__desc">8 个段位，每个 3 级。最后一段不写在明面上。</p>
          </div>
          <button type="button" className="link-button" onClick={() => navigate('tiers')}>
            查看完整段位表 →
          </button>
        </div>
        <div className="tier-preview">
          {TIER_ORDER.map((id, i) => (
            <TierPreviewRow key={id} tierId={id} nextTierId={TIER_ORDER[i + 1]} xp={save.xp} placed={save.placed} />
          ))}
        </div>
      </section>

      <section className="section section--rules">
        <div className="rules-strip">
          <div>
            <h2>规则透明</h2>
            <p>
              经验只来自首测（一次性）与每日任务；同一任务每天最多一次奖励；单日经验有上限；
              刷新、连点、改系统时间都不会重复加分。全部规则在「段位表」里公开。
            </p>
          </div>
          <div className="rules-strip__actions">
            <button type="button" className="button button--ghost" onClick={() => navigate('tiers')}>
              查看积分规则
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setQuickOpen((v) => !v)}
              aria-expanded={quickOpen}
            >
              {quickOpen ? '收起' : '这个网站收集什么？'}
            </button>
          </div>
        </div>
        {quickOpen && (
          <div className="rules-detail">
            <p>
              不收集真实姓名、手机号、通讯录、定位或任何账号信息。只在你自己的浏览器里保存游戏进度。
              你可以随时在「数据与设置」里导出或重置。
            </p>
            <button type="button" className="link-button" onClick={() => navigate('settings')}>
              打开数据与设置 →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function TierPreviewRow({
  tierId,
  nextTierId,
  xp,
  placed,
}: {
  tierId: TierId;
  nextTierId?: TierId;
  xp: number;
  placed: boolean;
}) {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return null;
  const next = nextTierId ? TIERS.find((t) => t.id === nextTierId) : undefined;
  const current = xp >= tier.thresholds[0] && (!next || xp < next.thresholds[0]);
  const hidden = Boolean(tier.hidden) && !(placed && xp >= tier.thresholds[0]);
  return (
    <div className={`tier-preview__row ${current ? 'is-current' : ''} ${hidden ? 'is-hidden' : ''}`}>
      <span className="tier-preview__dot" style={{ background: hidden ? '#333a4d' : tier.color }} aria-hidden="true" />
      <span className="tier-preview__name">{hidden ? '???' : tier.name}</span>
      <span className="tier-preview__epithet">{hidden ? '隐藏段位 · 达成后揭晓' : tier.epithet}</span>
      <span className="tier-preview__xp">{hidden ? '???' : `${tier.thresholds[0]} XP 起`}</span>
      {current && <span className="pill pill--good">当前</span>}
    </div>
  );
}
