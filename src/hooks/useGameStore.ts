/**
 * 本地存档 Hook：读写、迁移状态、跨标签页同步、安全模式、跨天刷新。
 * 所有组件只通过这里访问存档，避免多处直接碰 localStorage。
 *
 * 关键实现约定：
 * - setSave 的 updater 必须是纯函数（React StrictMode 会重复调用）；
 *   需要 toast / 成就提示时，先在组件里算出结果，再 setSave(() => 结果)。
 * - 持久化统一由 effect 节流完成，页面隐藏时立即 flush。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKUP_KEY,
  STORAGE_KEY,
  createDefaultSave,
  exportSave,
  importSave,
  loadSave,
  readCorruptRaw,
  saveData,
  todayKey,
  wipeStorage,
  type BadgeUnlock,
  type LoadStatus,
  type SaveData,
} from '../lib/storage';
import { ensureToday, evaluateBadges } from '../lib/game';

export interface StorageNotice {
  kind: 'info' | 'warn' | 'error';
  title: string;
  detail?: string;
  /** 原始损坏内容，可下载 */
  raw?: string;
  persistent?: boolean;
}

export interface ImportOutcome {
  ok: boolean;
  message: string;
  newBadges?: BadgeUnlock[];
}

export interface GameStore {
  save: SaveData;
  setSave: (updater: (prev: SaveData) => SaveData) => void;
  status: LoadStatus;
  message: string;
  notice: StorageNotice | null;
  dismissNotice: () => void;
  /** 立即持久化（默认 120ms 节流） */
  flush: () => void;
  resetAll: () => { newBadges: BadgeUnlock[] };
  exportText: () => string;
  importText: (text: string) => ImportOutcome;
  corruptRaw: string | null;
  storageAvailable: boolean;
}

const AUTO_SAVE_MS = 120;

function bootstrap(): { save: SaveData; status: LoadStatus; message: string; raw?: string; newBadges: BadgeUnlock[] } {
  const loaded = loadSave();
  // 加载后统一跑一次徽章评估：兼容"新版本新增徽章"与"损坏恢复"指标。
  const evaluated = evaluateBadges(ensureToday(loaded.save));
  // 从备份 / 修复中恢复时，立即把修复后的存档写回主档，
  // 避免损坏内容留在 localStorage 里导致每次刷新都重复恢复。
  if (loaded.status === 'recovered-backup' || loaded.status === 'repaired' || loaded.status === 'migrated') {
    saveData(evaluated.save);
  }
  return {
    save: evaluated.save,
    status: loaded.status,
    message: loaded.message,
    raw: loaded.rawCorrupt,
    newBadges: evaluated.newBadges,
  };
}

export function useGameStore(): GameStore {
  const [initial] = useState(() => bootstrap());
  const [save, setSaveState] = useState<SaveData>(() => initial.save);
  const [notice, setNotice] = useState<StorageNotice | null>(() => {
    if (initial.status === 'fresh' || initial.status === 'ok') return null;
    if (initial.status === 'migrated') {
      return { kind: 'info', title: '存档已升级', detail: initial.message };
    }
    if (initial.status === 'recovered-backup' || initial.status === 'repaired') {
      return {
        kind: 'warn',
        title: '检测到存档异常，已恢复',
        detail: `${initial.message} 建议在设置里导出一次备份。`,
        raw: initial.raw,
        persistent: true,
      };
    }
    return {
      kind: 'error',
      title: '存档无法读取',
      detail: `${initial.message} 你可以先下载原始数据，再选择重置。`,
      raw: initial.raw,
      persistent: true,
    };
  });
  const [corruptRaw, setCorruptRaw] = useState<string | null>(() => initial.raw ?? readCorruptRaw());

  const timer = useRef<number | null>(null);
  const pending = useRef<SaveData | null>(null);
  const lastPersisted = useRef<SaveData | null>(initial.save);
  const mounted = useRef(true);

  const persistNow = useCallback((next: SaveData) => {
    const result = saveData(next);
    if (!result.ok) {
      setNotice({
        kind: 'error',
        title: '进度保存失败',
        detail: `浏览器拒绝写入本地存储（${result.error ?? '未知原因'}）。可能是隐私模式或空间已满，建议先导出进度。`,
        persistent: true,
      });
    }
    return result;
  }, []);

  /** 立即落盘待写数据 */
  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      persistNow(next);
      lastPersisted.current = next;
    }
  }, [persistNow]);

  const setSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSaveState((prev) => updater(prev));
  }, []);

  // 统一节流持久化
  useEffect(() => {
    if (save === lastPersisted.current) return;
    pending.current = save;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!pending.current) return;
      const next = pending.current;
      pending.current = null;
      persistNow(next);
      lastPersisted.current = next;
    }, AUTO_SAVE_MS);
    return () => {
      // 卸载时把待写数据落盘
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (pending.current) {
        const next = pending.current;
        pending.current = null;
        persistNow(next);
      }
    };
  }, [save, persistNow]);

  // 页面隐藏 / 关闭前强制落盘
  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flush]);

  // 跨天自动刷新（本地时间 00:00 过后；时区变化也覆盖）
  useEffect(() => {
    const check = () => {
      setSaveState((prev) => {
        if (!prev.today || prev.today.date !== todayKey()) return ensureToday(prev);
        return prev;
      });
    };
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  // 跨标签页同步：另一个标签页写入时，当前页跟随
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const reloaded = loadSave();
      if (reloaded.status === 'ok' || reloaded.status === 'migrated') {
        const next = evaluateBadges(ensureToday(reloaded.save)).save;
        lastPersisted.current = next;
        setSaveState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resetAll = useCallback((): { newBadges: BadgeUnlock[] } => {
    flush();
    const resetCount = save.stats.resets + 1;
    const resetAt = Date.now();
    wipeStorage();
    const fresh = createDefaultSave();
    fresh.stats = { ...fresh.stats, resets: resetCount, lastResetAt: resetAt };
    const evaluated = evaluateBadges(ensureToday(fresh));
    // 重置后的"重新做人"徽章也算新解锁，交给 UI 提示
    setSaveState(evaluated.save);
    lastPersisted.current = null;
    pending.current = null;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    saveData(evaluated.save);
    lastPersisted.current = evaluated.save;
    setCorruptRaw(null);
    setNotice(null);
    return { newBadges: evaluated.newBadges };
  }, [flush, save.stats.resets]);

  const exportText = useCallback(() => exportSave(save), [save]);

  const importText = useCallback(
    (text: string): ImportOutcome => {
      const result = importSave(text);
      if (!result.ok) return { ok: false, message: result.message };
      flush();
      const evaluated = evaluateBadges(ensureToday(result.save));
      setSaveState(evaluated.save);
      lastPersisted.current = null;
      pending.current = null;
      saveData(evaluated.save);
      lastPersisted.current = evaluated.save;
      setCorruptRaw(null);
      setNotice({ kind: 'info', title: '导入成功', detail: result.message });
      return { ok: true, message: result.message, newBadges: evaluated.newBadges };
    },
    [flush],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);
  const message = useMemo(() => initial.message, [initial.message]);
  const storageAvailable = initial.status !== 'corrupt' || initial.raw !== undefined;

  return {
    save,
    setSave,
    status: initial.status,
    message,
    notice,
    dismissNotice,
    flush,
    resetAll,
    exportText,
    importText,
    corruptRaw,
    storageAvailable,
  };
}

export { BACKUP_KEY, STORAGE_KEY };
