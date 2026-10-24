import { useEffect, useRef, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import { useRouter } from '../app/router';
import { DAILY_RULES, JUDGE_ITEMS, TASK_TYPE_LABEL } from '../config/daily';
import { BADGE_MAP } from '../config/badges';
import { completeTask, type TaskOutcome } from '../lib/game';
import type { DailyTask } from '../lib/storage';
import { PageHeader, EmptyState } from '../components/Layout';

export function DailyPage({ store, notify }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const save = store.save;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<TaskOutcome | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const today = save.today;
  const doneCount = today?.done.length ?? 0;

  useEffect(() => {
    if (lastOutcome?.accepted) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastOutcome]);

  if (!save.placed || !today) {
    return (
      <div className="page page--narrow">
        <EmptyState
          icon="🔒"
          title="先测出你的初始段位"
          desc="每日挑战会累计经验；为了不让经验值白给，先完成 14 道首测题。"
          action={
            <button type="button" className="button button--primary" onClick={() => navigate('quiz')}>
              去完成首测
            </button>
          }
        />
      </div>
    );
  }

  const allDone = doneCount >= today.tasks.length;
  const openTask = today.tasks.find((t) => t.id === openTaskId) ?? null;

  function settle(taskId: string, value?: boolean | number, multiplier = 1) {
    // StrictMode 下 updater 会被调用两次，因此先在 updater 外算好结果再写入。
    const outcome = completeTask(store.save, { taskId, value, multiplier });
    if (!outcome.accepted) {
      if (outcome.reason === 'already-done') {
        notify({ kind: 'warn', title: '这个任务今天已经结算过了', detail: '同一任务每天只能获得一次奖励。' });
      } else if (outcome.reason === 'daily-cap') {
        notify({ kind: 'warn', title: '今日经验已达上限', detail: '明天再来，经验上限每天重置。' });
      } else {
        notify({ kind: 'warn', title: '任务暂时无法结算', detail: '请刷新页面后重试。' });
      }
      setOpenTaskId(null);
      return;
    }
    store.setSave(() => outcome.save);
    setLastOutcome(outcome);
    notify({
      kind: 'xp',
      title: `任务完成 +${outcome.xpGained} XP`,
      detail: outcome.bonusXp > 0 ? `含连续/全清奖励 ${outcome.bonusXp} XP` : undefined,
    });
    if (outcome.perfectDay) {
      notify({ kind: 'info', title: '今日任务全清 🎉', detail: '额外奖励已计入，明天继续。' });
    }
    for (const badge of outcome.newBadges) {
      const def = BADGE_MAP[badge.id];
      notify({ kind: 'badge', title: `解锁徽章：${def?.name ?? badge.id}`, detail: def?.desc, icon: def?.icon ?? '🏅' });
    }
    if (outcome.levelAfter > outcome.levelBefore) {
      notify({
        kind: 'level',
        title: '段位提升了！',
        detail: `现在是 LV.${outcome.levelAfter + 1}，去个人主页看看新称号。`,
      });
    }
    setOpenTaskId(null);
  }

  return (
    <div className="page page--narrow daily">
      <PageHeader
        eyebrow={`DAILY CHALLENGE · ${today.date}`}
        title="今日挑战"
        desc={`每天提供 ${DAILY_RULES.count} 个轻量任务，每个任务每天只结算一次。完成全部 3 个有额外奖励；连续挑战有递增经验（满 10 天封顶）。`}
        actions={
          <div className="streak-box">
            <span className="streak-box__flame" aria-hidden="true">🔥</span>
            <div>
              <div className="streak-box__value">{save.stats.currentStreak} 天</div>
              <div className="streak-box__label">连续挑战</div>
            </div>
          </div>
        }
      />

      <div className="daily-summary">
        <div className="daily-summary__bar">
          <div className="daily-summary__fill" style={{ width: `${(doneCount / Math.max(1, today.tasks.length)) * 100}%` }} />
        </div>
        <span className="daily-summary__text">
          今日进度 {doneCount}/{today.tasks.length}
          {allDone ? ' · 已全清' : ''}
        </span>
      </div>

      <div className="daily-grid">
        {today.tasks.map((task, index) => {
          const done = today.done.includes(task.id);
          const judge = task.judgeId ? JUDGE_ITEMS.find((j) => j.id === task.judgeId) : null;
          return (
            <article key={task.id} className={`daily-card ${done ? 'is-done' : ''}`}>
              <div className="daily-card__head">
                <span className="daily-card__index">0{index + 1}</span>
                <span className="daily-card__type">{TASK_TYPE_LABEL[task.type]}</span>
                <span className="daily-card__xp">+{task.xp} XP</span>
              </div>
              <div className="daily-card__glyph" aria-hidden="true">
                {task.glyph}
              </div>
              <h2 className="daily-card__title">{task.title}</h2>
              <p className="daily-card__desc">{task.desc}</p>

              {task.type === 'choice' && task.options && (
                <div className="daily-card__body">
                  {done ? (
                    <div className="daily-done-badge">✓ 已完成 · 今日不再结算</div>
                  ) : (
                    <button type="button" className="button button--primary button--wide" onClick={() => setOpenTaskId(task.id)}>
                      做出选择
                    </button>
                  )}
                </div>
              )}
              {(task.type === 'judge' || task.type === 'tap' || task.type === 'timer') && (
                <div className="daily-card__body">
                  {done ? (
                    <div className="daily-done-badge">✓ 已完成 · 今日不再结算</div>
                  ) : (
                    <button type="button" className="button button--primary button--wide" onClick={() => setOpenTaskId(task.id)}>
                      {task.type === 'judge' ? '开始判断' : task.type === 'tap' ? '开始手速挑战' : '开始计时'}
                    </button>
                  )}
                </div>
              )}
              {judge && task.type === 'judge' && !done && (
                <div className="daily-card__hint">提示：有出处、有主体、有可执行建议的消息才值得转发。</div>
              )}
            </article>
          );
        })}
      </div>

      {lastOutcome?.accepted && (
        <div ref={resultRef} className={`daily-result ${lastOutcome.perfectDay ? 'daily-result--perfect' : ''}`} role="status">
          <div className="daily-result__icon" aria-hidden="true">
            {lastOutcome.perfectDay ? '🎉' : '✦'}
          </div>
          <div>
            <strong>+{lastOutcome.xpGained} XP 已入账</strong>
            <p>
              当前 {store.save.xp} XP
              {lastOutcome.bonusXp > 0 ? `（其中奖励 ${lastOutcome.bonusXp} XP）` : ''}
              {lastOutcome.perfectDay ? ' · 今日全清奖励已发放' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="daily-foot">
        <div>
          <h3>经验怎么算？</h3>
          <p>
            每个任务固定经验（见卡片），当天 3 个全部完成额外 +30，连续挑战第 1 天 +3、逐日递增、封顶 +30。
            单日经验上限 300，超过后不再累加；所有发放都写入本地账本。
          </p>
        </div>
        <button type="button" className="button button--ghost" onClick={() => navigate('profile')}>
          查看历史成绩
        </button>
      </div>

      {openTask && (
        <TaskModal
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onComplete={(value, multiplier) => settle(openTask.id, value, multiplier)}
        />
      )}
    </div>
  );
}

function TaskModal({
  task,
  onClose,
  onComplete,
}: {
  task: DailyTask;
  onClose: () => void;
  onComplete: (value?: boolean | number, multiplier?: number) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [judgeChoice, setJudgeChoice] = useState<boolean | null>(null);
  const [judgeRevealed, setJudgeRevealed] = useState(false);
  const judgeItem = task.judgeId ? JUDGE_ITEMS.find((j) => j.id === task.judgeId) : null;

  function finish(value?: boolean | number, multiplier = 1) {
    if (submitting) return;
    setSubmitting(true);
    onComplete(value, multiplier);
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div className="modal__head">
          <h2 id="task-modal-title" className="modal__title">
            <span aria-hidden="true">{task.glyph}</span> {task.title}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭任务">
            ×
          </button>
        </div>
        <div className="modal__body">
          <p className="task-modal__desc">{task.desc}</p>
          <div className="task-modal__reward">完成奖励 +{task.xp} XP · 今日仅此一次</div>

          {task.type === 'choice' && task.options && (
            <div className="task-options">
              {task.options.map((option, i) => (
                <button
                  key={option.text}
                  type="button"
                  className={`task-option ${selected === i ? 'is-selected' : ''}`}
                  onClick={() => setSelected(i)}
                  disabled={submitting}
                >
                  <span className="task-option__key">{String.fromCharCode(65 + i)}</span>
                  <span>{option.text}</span>
                </button>
              ))}
            </div>
          )}

          {task.type === 'judge' && judgeItem && (
            <div className="task-judge">
              <blockquote className="task-judge__quote">{judgeItem.prompt}</blockquote>
              {!judgeRevealed ? (
                <div className="task-judge__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      setJudgeChoice(false);
                      setJudgeRevealed(true);
                    }}
                  >
                    ✕ 不该转发
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setJudgeChoice(true);
                      setJudgeRevealed(true);
                    }}
                  >
                    ✓ 可以转发
                  </button>
                </div>
              ) : (
                <div className={`task-judge__result ${judgeChoice === judgeItem.shouldShare ? 'is-correct' : 'is-wrong'}`}>
                  <strong>{judgeChoice === judgeItem.shouldShare ? '判断正确' : '判断偏了'}</strong>
                  <p>{judgeItem.explain}</p>
                </div>
              )}
            </div>
          )}

          {task.type === 'tap' && <TapGame task={task} onWin={() => finish(true)} />}

          {task.type === 'timer' && <TimerGame task={task} onDone={() => finish(undefined)} />}
        </div>

        <div className="modal__foot">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={submitting}>
            先不做
          </button>
          {task.type === 'choice' && (
            <button
              type="button"
              className="button button--primary"
              disabled={selected === null || submitting}
              onClick={() => selected !== null && finish(selected)}
            >
              确认选择
            </button>
          )}
          {task.type === 'judge' && (
            <button
              type="button"
              className="button button--primary"
              disabled={!judgeRevealed || submitting}
              onClick={() => finish(judgeChoice === judgeItem?.shouldShare)}
            >
              {judgeRevealed ? '领取奖励' : '先做判断'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 手速挑战：限时点掉目标，成功后领取完整经验 */
function TapGame({ task, onWin }: { task: DailyTask; onWin: () => void }) {
  const targets = task.targets ?? 6;
  const limit = task.timeLimitMs ?? 12000;
  const [left, setLeft] = useState(targets);
  const [remainingMs, setRemainingMs] = useState(limit);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [won, setWon] = useState(false);
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const idRef = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const rest = Math.max(0, limit - elapsed);
      setRemainingMs(rest);
      if (rest <= 0) {
        setRunning(false);
        setFailed(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, limit]);

  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => {
      setFailed(false);
      setLeft(targets);
      setRemainingMs(limit);
      setPositions([]);
    }, 1600);
    return () => window.clearTimeout(t);
  }, [failed, targets, limit]);

  const spawn = () => {
    idRef.current += 1;
    const seed = idRef.current * 37;
    return { x: 8 + ((seed * 13) % 74), y: 8 + ((seed * 29) % 66) };
  };

  function start() {
    setLeft(targets);
    setRemainingMs(limit);
    setFailed(false);
    setWon(false);
    setPositions(Array.from({ length: targets }, () => spawn()));
    startedAt.current = Date.now();
    setRunning(true);
  }

  function hit(index: number) {
    if (!running) return;
    const next = positions.filter((_, i) => i !== index);
    setPositions(next);
    setLeft(next.length);
    if (next.length === 0) {
      setRunning(false);
      setWon(true);
      window.setTimeout(onWin, 350);
    }
  }

  return (
    <div className="tap-game">
      <div className="tap-game__hud">
        <span>剩余目标 {left}</span>
        <span>{(remainingMs / 1000).toFixed(1)}s</span>
      </div>
      <div className="tap-game__stage">
        {!running && !won && (
          <button type="button" className="button button--primary" onClick={start}>
            {failed ? '再来一次' : '开始'}
          </button>
        )}
        {won && <div className="tap-game__win">清空！正在结算…</div>}
        {failed && <div className="tap-game__fail">时间到，再试一次</div>}
        {running &&
          positions.map((p, i) => (
            <button
              key={`${i}-${p.x}-${p.y}`}
              type="button"
              className="tap-target"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={() => hit(i)}
              aria-label={`关闭第 ${i + 1} 个弹窗`}
            >
              ✕
            </button>
          ))}
      </div>
      <p className="tap-game__hint">点掉全部弹窗即完成；超时可重试，不消耗次数。</p>
    </div>
  );
}

/** 离线计时：20 秒，离开页面也继续计时（不强制通知） */
function TimerGame({ task, onDone }: { task: DailyTask; onDone: () => void }) {
  const total = task.seconds ?? 20;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);

  return (
    <div className="timer-game">
      <div className="timer-game__ring" style={{ ['--p' as string]: `${(1 - left / total) * 100}%` }}>
        <span className="timer-game__value">{left}</span>
        <span className="timer-game__unit">秒</span>
      </div>
      {!running && !finished && (
        <button type="button" className="button button--primary" onClick={() => setRunning(true)}>
          开始计时
        </button>
      )}
      {running && <p className="muted">把视线移开屏幕，慢慢呼吸。倒计时结束会自动结算。</p>}
      {finished && <p className="muted">完成。奖励正在入账。</p>}
    </div>
  );
}
