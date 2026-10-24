import { useCallback, useRef, useState } from 'react';

export interface Toast {
  id: number;
  kind: 'xp' | 'badge' | 'level' | 'info' | 'warn';
  title: string;
  detail?: string;
  icon?: string;
}

export interface ToastApi {
  list: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

/** 极简 toast 队列：同屏最多 4 条，4.5 秒自动消失 */
export function useToasts(): ToastApi {
  const [list, setList] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setList((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId.current;
    nextId.current += 1;
    setList((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setList((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return { list, push, dismiss };
}

const KIND_ICON: Record<Toast['kind'], string> = {
  xp: '✦',
  badge: '🏅',
  level: '⬆',
  info: 'ℹ',
  warn: '⚠',
};

export function ToastLayer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: ToastApi['dismiss'] }) {
  return (
    <div className="toast-layer" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`}>
          <span className="toast__icon" aria-hidden="true">
            {toast.icon ?? KIND_ICON[toast.kind]}
          </span>
          <div className="toast__body">
            <div className="toast__title">{toast.title}</div>
            {toast.detail && <div className="toast__detail">{toast.detail}</div>}
          </div>
          <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="关闭提示">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
