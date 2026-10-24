import type { LevelProgress, RankSummary } from '../lib/game';

export function XpBar({
  progress,
  compact = false,
  label,
}: {
  progress: LevelProgress;
  compact?: boolean;
  label?: string;
}) {
  return (
    <div className={`xpbar ${compact ? 'xpbar--compact' : ''}`}>
      <div className="xpbar__head">
        <span className="xpbar__label">{label ?? (progress.isMax ? 'MAX LEVEL' : `LV.${progress.level.index + 1} → ${progress.level.step === 3 ? '下一段位' : '下一级'}`)}</span>
        <span className="xpbar__value">
          <strong>{progress.into}</strong> / {progress.isMax ? '—' : progress.span} XP
        </span>
      </div>
      <div
        className="xpbar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="等级经验进度"
      >
        <div className="xpbar__fill" style={{ width: `${progress.percent}%` }}>
          <span className="xpbar__shine" aria-hidden="true" />
        </div>
        <div className="xpbar__ticks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <div className="xpbar__foot">
        <span>{progress.isMax ? '已到达当前版本最高等级' : `距 ${progress.next?.title ?? '下一级'} 还差 ${progress.remaining} XP`}</span>
        <span className="xpbar__percent">{progress.percent}%</span>
      </div>
    </div>
  );
}

export function RankEmblem({ summary, size = 'md' }: { summary: RankSummary; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={`emblem emblem--${size}`}
      style={
        {
          '--tier': summary.tierColor,
          '--tier-dark': summary.tierColorDark,
        } as React.CSSProperties
      }
      aria-label={`${summary.tierName} ${summary.step} 级徽记`}
    >
      <div className="emblem__ring" aria-hidden="true" />
      <div className="emblem__hex">
        <div className="emblem__inner">
          <span className="emblem__tier">{summary.tierName}</span>
          <span className="emblem__roman">{['I', 'II', 'III'][summary.step - 1]}</span>
          <span className="emblem__sub">{summary.tierEpithet}</span>
        </div>
      </div>
    </div>
  );
}

/** 属性条（信息 / 社交 / 松弛） */
export function AxisBars({ axes }: { axes: { info: number; social: number; vibe: number } }) {
  const rows = [
    { key: 'info' as const, name: '信息雷达', color: '#63e6c2', desc: '溯源 · 核实' },
    { key: 'social' as const, name: '社交电量', color: '#ff6b9d', desc: '表达 · 互动' },
    { key: 'vibe' as const, name: '赛博松弛', color: '#69a6ff', desc: '断网 · 边界' },
  ];
  return (
    <div className="axis-bars">
      {rows.map((row) => (
        <div className="axis" key={row.key}>
          <div className="axis__head">
            <span className="axis__name">
              <span className="axis__dot" style={{ background: row.color }} aria-hidden="true" />
              {row.name}
            </span>
            <span className="axis__value">{axes[row.key]}</span>
          </div>
          <div className="axis__track">
            <div className="axis__fill" style={{ width: `${axes[row.key]}%`, background: row.color }} />
          </div>
          <span className="axis__desc">{row.desc}</span>
        </div>
      ))}
    </div>
  );
}
