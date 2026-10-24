import { useRef, useState } from 'react';
import type { GameStore } from '../hooks/useGameStore';
import type { ToastApi } from '../components/Toasts';
import { useRouter } from '../app/router';
import { BADGES } from '../config/badges';
import { ECONOMY } from '../config/economy';
import { SITE, ROADMAP } from '../config/site';
import { STORAGE_KEY, SCHEMA_VERSION, readCorruptRaw } from '../lib/storage';
import { PageHeader } from '../components/Layout';

export function SettingsPage({ store, notify }: { store: GameStore; notify: ToastApi['push'] }) {
  const { navigate } = useRouter();
  const save = store.save;
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  /** 预览只截取前 4000 字展示；导入必须使用完整原文 */
  const [importText, setImportText] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const corrupt = store.corruptRaw ?? readCorruptRaw();

  function download() {
    const text = store.exportText();
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `互联网生存段位-进度-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify({ kind: 'info', title: '进度已导出', detail: 'JSON 含版本号与校验和，可随时导回。' });
  }

  function downloadCorrupt() {
    if (!corrupt) return;
    const blob = new Blob([corrupt], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `互联网生存段位-损坏存档-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportMsg({ ok: false, text: '文件超过 2MB，不像是本站进度文件。' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportText(text);
      setPreview(text.slice(0, 4000));
      setImportMsg(null);
    };
    reader.onerror = () => setImportMsg({ ok: false, text: '读取文件失败，请重试。' });
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!importText) return;
    const result = store.importText(importText);
    setImportMsg({ ok: result.ok, text: result.message });
    if (result.ok) {
      notify({ kind: 'info', title: '导入成功', detail: result.message });
      setPreview(null);
      setImportText(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function doReset() {
    if (resetPhrase.trim() !== '重置') return;
    store.resetAll();
    setConfirmReset(false);
    setResetPhrase('');
    notify({ kind: 'warn', title: '进度已重置', detail: '本地存档已清空，可以重新开始首测。' });
    navigate('home');
  }

  function toggleMotion() {
    store.setSave((prev) => ({ ...prev, reduceMotion: !prev.reduceMotion }));
  }

  return (
    <div className="page settings">
      <PageHeader
        eyebrow="DATA & SETTINGS"
        title="数据与设置"
        desc="管理你的本地存档。这里没有任何上传按钮，因为首版没有后端。"
        actions={
          <button type="button" className="button button--ghost" onClick={() => navigate('profile')}>
            返回个人主页
          </button>
        }
      />

      {corrupt && (
        <section className="card settings-danger">
          <h2>检测到损坏的原始存档</h2>
          <p>
            系统在某次读取时发现存档异常，原始内容仍保留在浏览器中（键名 <code>isr:save:v1.corrupt</code>）。
            你可以先下载留档，再重置进度。
          </p>
          <div className="settings-actions">
            <button type="button" className="button button--ghost" onClick={downloadCorrupt}>
              下载损坏原始数据
            </button>
          </div>
        </section>
      )}

      <div className="settings-grid">
        <section className="card">
          <h2>存档状态</h2>
          <dl className="kv">
            <div>
              <dt>数据版本</dt>
              <dd>v{SCHEMA_VERSION}</dd>
            </div>
            <div>
              <dt>本地键名</dt>
              <dd>
                <code>{STORAGE_KEY}</code>
              </dd>
            </div>
            <div>
              <dt>当前经验</dt>
              <dd>{save.xp} XP</dd>
            </div>
            <div>
              <dt>首次创建</dt>
              <dd>{new Date(save.createdAt).toLocaleString('zh-CN')}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{new Date(save.updatedAt).toLocaleString('zh-CN')}</dd>
            </div>
            <div>
              <dt>徽章</dt>
              <dd>
                {save.badges.length}/{BADGES.length}
              </dd>
            </div>
          </dl>
          <p className="muted small">
            存档写入时自动带校验和，并保留上一份备份。读取失败时会先尝试备份，再尝试修复，最后才进入安全模式。
          </p>
        </section>

        <section className="card">
          <h2>导出 / 导入</h2>
          <p className="muted small">
            导出的 JSON 含 <code>schemaVersion</code> 与校验和，可在另一台设备或另一个浏览器导入。导入会覆盖当前进度。
          </p>
          <div className="settings-actions">
            <button type="button" className="button button--primary" onClick={download}>
              导出进度 JSON
            </button>
            <button type="button" className="button button--ghost" onClick={() => fileRef.current?.click()}>
              选择文件导入
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
              aria-label="选择进度文件"
            />
          </div>
          {preview && (
            <div className="import-preview">
              <div className="import-preview__head">
                <strong>待导入内容预览</strong>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setPreview(null);
                    setImportText(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  取消
                </button>
              </div>
              <pre className="import-preview__code">{preview.slice(0, 800)}{preview.length > 800 ? '\n…' : ''}</pre>
              <button type="button" className="button button--primary button--wide" onClick={confirmImport}>
                确认导入并覆盖当前进度
              </button>
            </div>
          )}
          {importMsg && (
            <p className={importMsg.ok ? 'form-msg form-msg--ok' : 'form-msg form-msg--err'} role="status">
              {importMsg.text}
            </p>
          )}
        </section>

        <section className="card">
          <h2>显示</h2>
          <div className="setting-row">
            <div>
              <strong>减少动画</strong>
              <p className="muted small">关闭升级闪光、像素粒子与过渡动画。系统级「减少动态效果」也会被自动尊重。</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={save.reduceMotion} onChange={toggleMotion} />
              <span className="switch__track" aria-hidden="true" />
              <span className="visually-hidden">减少动画</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>娱乐与隐私声明</h2>
          <p>{SITE.disclaimer}</p>
          <p className="muted small">{SITE.privacy}</p>
          <div className="roadmap">
            <h3>未上线的后端能力</h3>
            <ul>
              {ROADMAP.map((item) => (
                <li key={item.id}>
                  <span className="pill pill--muted">未上线</span> <strong>{item.name}</strong> · {item.desc}
                </li>
              ))}
            </ul>
            <p className="muted small">首版不包含账号、排行榜或好友系统，页面不会向任何服务器发送请求。</p>
          </div>
        </section>

        <section className="card settings-danger">
          <h2>危险区域</h2>
          <p>
            重置会清空段位、经验、徽章、历史与连续挑战记录，并删除本地备份。此操作无法撤销，建议先导出。
          </p>
          <div className="settings-actions">
            <button type="button" className="button button--danger" onClick={() => setConfirmReset(true)}>
              重置全部进度
            </button>
          </div>
          <p className="muted small">
            规则参考：每日任务每次 +{ECONOMY.taskXpMin}~{ECONOMY.taskXpMax} XP，单日上限 {ECONOMY.dailyXpCap} XP；重置后当天从 0 开始。
          </p>
        </section>
      </div>

      {confirmReset && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirmReset(false)}>
          <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="modal__head">
              <h2 id="reset-title" className="modal__title">
                确认重置全部进度？
              </h2>
              <button type="button" className="icon-button" onClick={() => setConfirmReset(false)} aria-label="取消重置">
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>
                这会删除本地存档、备份与全部徽章。输入 <strong>重置</strong> 两个字确认。
              </p>
              <input
                className="input"
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder="输入：重置"
                aria-label="确认文字"
                autoFocus
              />
            </div>
            <div className="modal__foot">
              <button type="button" className="button button--ghost" onClick={() => setConfirmReset(false)}>
                取消
              </button>
              <button type="button" className="button button--danger" disabled={resetPhrase.trim() !== '重置'} onClick={doReset}>
                永久删除并重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
