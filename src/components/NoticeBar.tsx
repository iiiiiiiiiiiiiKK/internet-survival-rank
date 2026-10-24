import type { StorageNotice } from '../hooks/useGameStore';

function downloadRaw(raw: string) {
  const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `互联网生存段位-损坏存档-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function NoticeBar({ notice, onDismiss }: { notice: StorageNotice | null; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div className={`notice notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <div className="notice__inner">
        <span className="notice__icon" aria-hidden="true">
          {notice.kind === 'error' ? '⛔' : notice.kind === 'warn' ? '⚠' : 'ℹ'}
        </span>
        <div className="notice__body">
          <strong>{notice.title}</strong>
          {notice.detail && <p>{notice.detail}</p>}
        </div>
        <div className="notice__actions">
          {notice.raw && (
            <button type="button" className="button button--ghost button--small" onClick={() => downloadRaw(notice.raw!)}>
              下载原始数据
            </button>
          )}
          <button type="button" className="icon-button" onClick={onDismiss} aria-label="关闭提示">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
