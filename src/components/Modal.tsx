import type { ReactNode } from 'react';

/** 统一的像素风弹窗：Esc 关闭、点遮罩关闭、焦点回到触发元素 */
export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  size = 'md',
  labelledBy = 'modal-title',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  labelledBy?: string;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="modal__head">
          <h2 id={labelledBy} className="modal__title">
            {title}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
