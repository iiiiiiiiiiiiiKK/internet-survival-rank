import { useEffect, useRef } from 'react';
import { useRouter } from '../app/router';

/** 首次进入的非阻塞说明：玩法、隐私、娱乐声明 */
export function OnboardingModal({ onClose, navigate }: { onClose: () => void; navigate: (r: 'home' | 'quiz' | 'settings') => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { route } = useRouter();

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal modal--md onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding__scan" aria-hidden="true" />
        <div className="modal__head">
          <h2 id="onboarding-title" className="modal__title">
            欢迎接入 · 互联网生存段位
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭欢迎说明">
            ×
          </button>
        </div>
        <div className="modal__body">
          <p className="onboarding__lead">
            14 道选择题决定你的初始段位，之后每天 3 个轻量挑战决定你能不能往上爬。
          </p>
          <ul className="onboarding__list">
            <li>
              <span aria-hidden="true">▸</span> 8 个段位 × 3 级，共 24 级；隐藏段位需要自己撞见。
            </li>
            <li>
              <span aria-hidden="true">▸</span> 每个任务每天只结算一次，刷新、连点、改时间都不会重复加分。
            </li>
            <li>
              <span aria-hidden="true">▸</span> 进度只保存在这个浏览器的 localStorage，随时可导出或重置。
            </li>
            <li>
              <span aria-hidden="true">▸</span> 这是娱乐玩法，不是真实能力评估，也不收集真实身份信息。
            </li>
          </ul>
        </div>
        <div className="modal__foot onboarding__foot">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              onClose();
              navigate(route === 'settings' ? 'home' : 'settings');
            }}
          >
            先看隐私说明
          </button>
          <button ref={ref} type="button" className="button button--primary" onClick={onClose}>
            开始游戏
          </button>
        </div>
      </div>
    </div>
  );
}
