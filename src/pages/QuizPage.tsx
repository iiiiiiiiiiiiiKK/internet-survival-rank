import { useEffect, useMemo, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import type { QuizAnswer } from '../lib/game';
import { drawPlacementQuestions, scorePlacement, applyQuizResult, type PlacementQuestion } from '../lib/game';
import { QUIZ_DRAW_COUNT } from '../config/quiz';
import { ECONOMY } from '../config/economy';
import { LEVELS } from '../config/tiers';
import { PageHeader } from '../components/Layout';
import { BADGE_MAP } from '../config/badges';
import { useRouter } from '../app/router';

interface Draft {
  questions: PlacementQuestion[];
  index: number;
  answers: QuizAnswer[];
}

function makeDraft(): Draft {
  return { questions: drawPlacementQuestions(), index: 0, answers: [] };
}

export function QuizPage({ store, notify }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const [draft, setDraft] = useState<Draft>(() => makeDraft());
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [finished, setFinished] = useState(false);

  const isRetake = store.save.placed;
  const question = draft.questions[draft.index];
  const progress = useMemo(() => ((draft.index + (selected !== null ? 1 : 0)) / QUIZ_DRAW_COUNT) * 100, [draft.index, selected]);

  useEffect(() => {
    if (!question) setFinished(true);
  }, [question]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [draft.index]);

  function pick(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
  }

  function next() {
    if (selected === null || finished) return;
    const answer: QuizAnswer = { questionId: question.id, optionIndex: selected };
    const answers = [...draft.answers, answer];
    if (answers.length >= QUIZ_DRAW_COUNT) {
      finish(answers);
      return;
    }
    setDraft({ ...draft, index: draft.index + 1, answers });
    setSelected(null);
  }

  function finish(answers: QuizAnswer[]) {
    setFinished(true);
    const score = scorePlacement(answers);
    const outcome = applyQuizResult(store.save, score, answers);
    store.setSave(() => outcome.save);
    if (outcome.rewarded) {
      notify({
        kind: 'xp',
        title: `首测结算 +${outcome.xpGained} XP`,
        detail: `起点：${LEVELS[outcome.levelAfter].title}`,
      });
    }
    for (const badge of outcome.newBadges) {
      const def = BADGE_MAP[badge.id];
      notify({ kind: 'badge', title: `解锁徽章：${def?.name ?? badge.id}`, detail: def?.desc, icon: def?.icon ?? '🏅' });
    }
    navigate('result');
  }

  function restart() {
    setDraft(makeDraft());
    setSelected(null);
    setFinished(false);
  }

  if (finished || !question) {
    return (
      <div className="page page--narrow">
        <PageHeader title="正在结算你的段位…" desc="如果页面没有自动跳转，请点击下面的按钮。" />
        <button type="button" className="button button--primary" onClick={() => navigate('result')}>
          查看结果
        </button>
      </div>
    );
  }

  return (
    <div className="page page--narrow quiz">
      <div className="quiz__topbar">
        <div className="quiz__meta">
          <span className="pill pill--muted">{isRetake ? '重测模式 · 不加经验' : '首次段位测试'}</span>
          <span className="quiz__counter">
            第 <strong>{draft.index + 1}</strong> / {QUIZ_DRAW_COUNT} 题
          </span>
        </div>
        <button type="button" className="link-button" onClick={() => setConfirmAbort(true)}>
          退出测试
        </button>
      </div>

      <div className="quiz__progress" role="progressbar" aria-valuemin={0} aria-valuemax={QUIZ_DRAW_COUNT} aria-valuenow={draft.index + 1}>
        <div className="quiz__progress-fill" style={{ width: `${Math.max(4, progress)}%` }} />
      </div>

      <div className="quiz__card card">
        <div className="quiz__scenario-label">SCENARIO {String(draft.index + 1).padStart(2, '0')}</div>
        <h1 className="quiz__scenario">{question.scenario}</h1>
        <div className="quiz__options" role="radiogroup" aria-label="请选择一个答案">
          {question.order.map((optionIndex, i) => {
            const option = question.options[optionIndex];
            const isSelected = selected === optionIndex;
            return (
              <button
                key={optionIndex}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`quiz-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => pick(optionIndex)}
                disabled={selected !== null}
              >
                <span className="quiz-option__key">{String.fromCharCode(65 + i)}</span>
                <span className="quiz-option__text">{option.text}</span>
                <span className="quiz-option__check" aria-hidden="true">
                  {isSelected ? '◉' : '○'}
                </span>
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="quiz__feedback" role="status">
            <span className="quiz__feedback-icon" aria-hidden="true">
              {question.options[selected].correct ? '✓' : '✕'}
            </span>
            <div>
              <strong>{question.options[selected].correct ? '这一步够稳。' : '这一步有点冒险。'}</strong>
              <p>{question.options[selected].note}</p>
              <span className="quiz__feedback-axis">
                属性 +1 · {question.options[selected].axis === 'info' ? '信息雷达' : question.options[selected].axis === 'social' ? '社交电量' : '赛博松弛'}
              </span>
            </div>
          </div>
        )}

        <div className="quiz__actions">
          <span className="quiz__hint">{selected === null ? '选择一个更接近你真实反应的选项' : '答案没有对错之分，只有生存率。'}</span>
          <button type="button" className="button button--primary button--wide" onClick={next} disabled={selected === null}>
            {draft.index + 1 === QUIZ_DRAW_COUNT ? '提交并生成段位' : '下一题 →'}
          </button>
        </div>
      </div>

      <p className="quiz__legal">
        测试结果只是娱乐段位的起点（{ECONOMY.quizDrawCount} 题中随机抽取，满分 100%）。它不代表真实能力评估。
      </p>

      {confirmAbort && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirmAbort(false)}>
          <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="abort-title">
            <div className="modal__head">
              <h2 id="abort-title" className="modal__title">
                退出测试？
              </h2>
              <button type="button" className="icon-button" onClick={() => setConfirmAbort(false)} aria-label="继续测试">
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>当前作答不会保存。下次进入会重新抽题。</p>
            </div>
            <div className="modal__foot">
              <button type="button" className="button button--ghost" onClick={() => setConfirmAbort(false)}>
                继续答题
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  setConfirmAbort(false);
                  restart();
                  navigate(isRetake ? 'profile' : 'home');
                }}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
