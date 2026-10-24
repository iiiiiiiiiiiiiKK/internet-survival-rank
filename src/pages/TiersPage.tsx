import { useEffect } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import { PageHeader } from '../components/Layout';
import { TIERS, LEVELS, PLACEMENT_BANDS } from '../config/tiers';
import { BADGES } from '../config/badges';
import { ECONOMY, theoreticalDailyMax, streakBonus } from '../config/economy';
import { DAILY_RULES } from '../config/daily';
import { levelProgress, touchStat, tierTable } from '../lib/game';

export function TiersPage({ store }: { store: GameStore }) {
  const save = store.save;
  const current = levelProgress(save.xp);
  const rows = tierTable(save.xp, save.xp >= TIERS[TIERS.length - 1].thresholds[0]);

  // 「查看完整段位表」是一次性指标（用于徽章），只在首次进入时 +1
  useEffect(() => {
    store.setSave((prev) => {
      if (prev.stats.tierListViews > 0) return prev;
      return touchStat(prev, 'tierListViews').save;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="RANK LADDER & RULES"
        title="段位表与积分规则"
        desc="8 个段位 × 3 个等级 = 24 级。所有数值都来自本地配置文件，页面展示与实际结算完全一致。"
        actions={
          <div className="current-pill">
            当前：<strong style={{ color: current.tier.color }}>{current.tier.name} {current.level.roman}</strong>
          </div>
        }
      />

      <div className="tier-table">
        {rows.map(({ tier, unlocked, isCurrent, hidden }) => (
          <section key={tier.id} className={`tier-block ${isCurrent ? 'is-current' : ''} ${hidden ? 'is-hidden' : ''}`}>
            <div className="tier-block__head">
              <span className="tier-block__swatch" style={{ background: hidden ? '#2a3144' : tier.color }} aria-hidden="true" />
              <div className="tier-block__names">
                <h2>{hidden ? '??? · 隐藏段位' : tier.name}</h2>
                <p>{hidden ? '达成条件后才会揭晓' : tier.epithet}</p>
              </div>
              {isCurrent && <span className="pill pill--good">你的段位</span>}
              {!unlocked && !hidden && <span className="pill pill--muted">未到达</span>}
            </div>
            {!hidden && <p className="tier-block__tagline">{tier.tagline}</p>}
            <div className="tier-levels">
              {LEVELS.filter((l) => l.tierId === tier.id).map((level) => {
                const reached = save.xp >= level.minXp;
                return (
                  <div
                    key={level.index}
                    className={`tier-level ${reached ? 'is-reached' : ''} ${isCurrent && level.index === current.level.index ? 'is-now' : ''}`}
                  >
                    <span className="tier-level__roman">{level.roman}</span>
                    <span className="tier-level__title">{hidden ? '???' : level.title}</span>
                    <span className="tier-level__xp">{hidden && !reached ? '???' : `${level.minXp} XP`}</span>
                    {reached && !hidden && <span className="tier-level__check" aria-label="已到达">✓</span>}
                    {isCurrent && level.index === current.level.index && <span className="tier-level__now">NOW</span>}
                  </div>
                );
              })}
            </div>
            {hidden && <p className="tier-block__hint">提示：隐藏段位与「在线时长」无关，与你在游戏里持续做出的选择有关。</p>}
          </section>
        ))}
      </div>

      <section className="card rules-card">
        <h2>可解释的本地积分系统</h2>
        <div className="rules-grid">
          <div>
            <h3>1. 首测决定起点</h3>
            <p>
              从 15 道题库随机抽 {ECONOMY.quizDrawCount} 题。正确率落在哪一档，就决定初始等级；
              首测经验只发一次，上限被限制在起点等级内，不会一跳满级。
            </p>
            <div className="band-table">
              {PLACEMENT_BANDS.map((band) => {
                const active =
                  save.lastQuiz !== null &&
                  save.lastQuiz.percent >= band.minPercent &&
                  (PLACEMENT_BANDS.find((b) => b.minPercent > band.minPercent)?.minPercent ?? 101) > save.lastQuiz.percent;
                return (
                  <div key={band.minPercent} className={`band-row ${active ? 'is-active' : ''}`}>
                    <span>≥ {band.minPercent}%</span>
                    <span>{levelsTitle(band.levelIndex)}</span>
                  </div>
                );
              })}
            </div>
            <p className="muted small">首测最高只能到「钻石 II」，后面的段位要靠每日挑战慢慢爬。</p>
          </div>
          <div>
            <h3>2. 每日挑战决定升级</h3>
            <ul className="rules-list">
              <li>每天 {DAILY_RULES.count} 个任务，类型不重复；任务由「日期 + 随机盐」生成，刷新不会变。</li>
              <li>每个任务每天只结算一次（完成任务 + 写入账本双重校验）。</li>
              <li>单个任务 {ECONOMY.taskXpMin}~{ECONOMY.taskXpMax} XP；当天全清额外 +{ECONOMY.dailyClearBonus} XP。</li>
              <li>连续挑战奖励：第 n 天 +{ECONOMY.streakBonusPerDay}×n，最多 +{ECONOMY.streakBonusCap} XP。</li>
              <li>单日经验上限 {ECONOMY.dailyXpCap} XP；超出部分不再累加。</li>
              <li>单日理论最大值 {theoreticalDailyMax()} XP，远低于任何"无限刷"路径。</li>
            </ul>
          </div>
          <div>
            <h3>3. 防重复与容错</h3>
            <ul className="rules-list">
              <li>连点：按钮提交后立即失效，同一任务 id 第二次返回「已领取」。</li>
              <li>刷新：任务完成状态与账本一起落盘，刷新不会重置。</li>
              <li>日期变化：跨过本地 00:00 自动生成新一天任务，旧记录归档。</li>
              <li>时区调整：日期按设备本地时间计算；回到过去的那一天会复用原记录，不重复发奖。</li>
              <li>数据损坏：自动尝试备份与结构修复；无法修复时进入安全模式，可下载原始数据后重置。</li>
            </ul>
          </div>
          <div>
            <h3>4. 徽章与段位的关系</h3>
            <p>
              {BADGES.length} 枚徽章按指标自动解锁，与段位互相独立：段位是经验总量，徽章是行为记录。
              徽章不会提供经验加成，也不影响段位升级速度。
            </p>
            <div className="streak-preview">
              {[1, 3, 7, 10].map((d) => (
                <span key={d} className="pill pill--muted">
                  连续 {d} 天 +{streakBonus(d)} XP
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="disclaimer-line">
          以上段位、经验与徽章均为娱乐玩法，不代表真实能力评估；本站不收集真实姓名、联系方式等非必要信息。
        </p>
      </section>
    </div>
  );
}

function levelsTitle(index: number): string {
  const l = LEVELS[index];
  const tier = TIERS.find((t) => t.id === l.tierId);
  return `${tier?.name ?? ''} ${l.roman} · ${l.title}`;
}
