/**
 * 存档与迁移（唯一读写入口）
 * ------------------------------------------------------------------
 * 设计要点：
 * 1. 带版本号（schemaVersion），并内置按版本顺序执行的迁移链。
 * 2. 每次写入带校验和（checksum），读取时校验；损坏时：
 *    - 尝试最近一次备份（<key>.bak）
 *    - 尝试宽松修复（补齐缺失字段、裁剪非法值）
 *    - 都失败则进入「安全模式」，由 UI 引导用户导出原始数据或重置。
 * 3. 日期一律用「设备本地日期」字符串 YYYY-MM-DD，不依赖 UTC，
 *    时区改变后每天任务会按新日期重新生成，旧记录保留。
 * 4. 写入前做节流合并，避免高频点击造成多次写盘。
 */

import { ECONOMY } from '../config/economy';
import { LEVELS } from '../config/tiers';
import { DAILY_RULES } from '../config/daily';

export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = 'isr:save:v1';
export const BACKUP_KEY = 'isr:save:v1.bak';
export const CORRUPT_KEY = 'isr:save:v1.corrupt';
export const SETTINGS_KEY = 'isr:settings:v1';

export type AxisKey = 'info' | 'social' | 'vibe';

export interface Axes {
  info: number;
  social: number;
  vibe: number;
}

/** 一次首测的留档 */
export interface QuizResultRecord {
  /** 完成时间戳 */
  at: number;
  /** 本地日期 YYYY-MM-DD */
  date: string;
  /** 抽到的题目 id，按作答顺序 */
  questionIds: string[];
  /** 每题是否答对 */
  correctFlags: boolean[];
  correctCount: number;
  total: number;
  percent: number;
  /** 首测产生的起点等级 */
  levelIndex: number;
  /** 三维属性 */
  axes: Axes;
  /** 是否为首测（false = 重测） */
  placement: boolean;
}

/** 每日任务实例（由日期种子生成，可复现） */
export interface DailyTask {
  /** `${date}:${templateId}` */
  id: string;
  templateId: string;
  type: 'choice' | 'judge' | 'tap' | 'timer';
  title: string;
  desc: string;
  xp: number;
  glyph: string;
  /** judge 型题目 id */
  judgeId?: string;
  /** choice 型选项 */
  options?: { text: string; tag: string }[];
  targets?: number;
  timeLimitMs?: number;
  seconds?: number;
}

export interface DailyDay {
  date: string;
  tasks: DailyTask[];
  /** 已完成任务 id */
  done: string[];
  /** 已领取的全清奖励 */
  clearBonusGiven: boolean;
}

/** 经验账本条目：任何加分都必须写一条，重复 id 会被拒绝 */
export interface LedgerEntry {
  /** 唯一 id：quiz | `task:${date}:${templateId}` | `clear:${date}` | `streak:${date}` */
  id: string;
  at: number;
  amount: number;
  label: string;
}

export interface BadgeUnlock {
  id: string;
  at: number;
}

export interface Stats {
  tasksCompleted: number;
  perfectDays: number;
  bestStreak: number;
  currentStreak: number;
  lastActiveDate: string | null;
  distinctDays: string[];
  nightTasks: number;
  calmChoices: number;
  offlineChoices: number;
  fightChoices: number;
  browseChoices: number;
  spreadChoices: number;
  judgeCorrect: number;
  tapWins: number;
  timerDone: number;
  sharesSquare: number;
  sharesTall: number;
  imports: number;
  resets: number;
  corruptRecoveries: number;
  tierListViews: number;
  quizRetakes: number;
  /** 上次重置时间（用于展示） */
  lastResetAt: number | null;
}

export interface SaveData {
  schemaVersion: number;
  /** 安装盐：用于每日任务随机种子，保证同一天刷新不变 */
  salt: string;
  /** 可选赛博昵称（不要求真实姓名），只存本地、只用于段位卡 */
  nickname: string;
  createdAt: number;
  updatedAt: number;
  /** 累计经验值（唯一真值） */
  xp: number;
  /** 当前等级序号（由 xp 推导，存档只做缓存） */
  levelIndex: number;
  /** 首测是否已完成 */
  placed: boolean;
  /** 最近一次测试结果 */
  lastQuiz: QuizResultRecord | null;
  /** 历史测试（最多保留 20 条） */
  quizHistory: QuizResultRecord[];
  /** 三维属性（首测生成，重测会覆盖） */
  axes: Axes;
  /** 今日任务缓存 */
  today: DailyDay | null;
  /** 历史每日记录（最多 60 天） */
  history: DailyDay[];
  /** 账本（默认保留最近 400 条；超过 400 条时保留全部以便审计经验来源） */
  ledger: LedgerEntry[];
  /** 已解锁徽章 */
  badges: BadgeUnlock[];
  stats: Stats;
  /** 是否开启减少动画 */
  reduceMotion: boolean;
  /** 数据修复标记：写入时出现过自动修复 */
  autoRepaired: boolean;
}

export function todayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 两个 YYYY-MM-DD 相差的天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  if (pa === null || pb === null) return Number.NaN;
  return Math.round((pb - pa) / 86400000);
}

function parseDateKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ts = new Date(y, mo - 1, d).getTime();
  if (Number.isNaN(ts)) return null;
  const back = new Date(ts);
  if (back.getFullYear() !== y || back.getMonth() !== mo - 1 || back.getDate() !== d) return null;
  return ts;
}

/** 简单的 24 位随机串（不用于安全用途） */
export function makeSalt(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function emptyStats(): Stats {
  return {
    tasksCompleted: 0,
    perfectDays: 0,
    bestStreak: 0,
    currentStreak: 0,
    lastActiveDate: null,
    distinctDays: [],
    nightTasks: 0,
    calmChoices: 0,
    offlineChoices: 0,
    fightChoices: 0,
    browseChoices: 0,
    spreadChoices: 0,
    judgeCorrect: 0,
    tapWins: 0,
    timerDone: 0,
    sharesSquare: 0,
    sharesTall: 0,
    imports: 0,
    resets: 0,
    corruptRecoveries: 0,
    tierListViews: 0,
    quizRetakes: 0,
    lastResetAt: null,
  };
}

export function createDefaultSave(now: number = Date.now()): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    salt: makeSalt(),
    nickname: '',
    createdAt: now,
    updatedAt: now,
    xp: 0,
    levelIndex: 0,
    placed: false,
    lastQuiz: null,
    quizHistory: [],
    axes: { info: 0, social: 0, vibe: 0 },
    today: null,
    history: [],
    ledger: [],
    badges: [],
    stats: emptyStats(),
    reduceMotion: false,
    autoRepaired: false,
  };
}

/* ------------------------------------------------------------------ */
/* 校验和                                                              */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 位，够用来发现手改/截断，不用于安全 */
export function checksumOf(obj: unknown): string {
  const text = stableStringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 稳定的 JSON 序列化（键排序），保证校验和可复现 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

interface Envelope {
  format: 'isr-save';
  schemaVersion: number;
  checksum: string;
  savedAt: number;
  data: SaveData;
}

export function wrapEnvelope(data: SaveData): Envelope {
  return {
    format: 'isr-save',
    schemaVersion: data.schemaVersion,
    checksum: checksumOf(data),
    savedAt: Date.now(),
    data,
  };
}

/* ------------------------------------------------------------------ */
/* 读取与修复                                                          */
/* ------------------------------------------------------------------ */

export type LoadStatus =
  | 'fresh' // 首次使用
  | 'ok'
  | 'migrated'
  | 'recovered-backup' // 主存档损坏，已用备份
  | 'repaired' // 结构可救，已修补
  | 'corrupt' // 无法恢复，进入安全模式
  | 'quota'; // 写入失败

export interface LoadResult {
  save: SaveData;
  status: LoadStatus;
  /** 人类可读的说明 */
  message: string;
  /** 原始损坏内容（用于导出求助） */
  rawCorrupt?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__isr_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function axesOf(v: unknown): Axes {
  const src = isObj(v) ? v : {};
  return {
    info: Math.round(num(src.info, 0, 0, 999)),
    social: Math.round(num(src.social, 0, 0, 999)),
    vibe: Math.round(num(src.vibe, 0, 0, 999)),
  };
}

function safeArray<T>(v: unknown, guard: (item: unknown) => item is T, limit: number): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(guard).slice(0, limit);
}

function isTask(v: unknown): v is DailyTask {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.templateId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.xp === 'number' &&
    (v.type === 'choice' || v.type === 'judge' || v.type === 'tap' || v.type === 'timer')
  );
}

function isLedgerEntry(v: unknown): v is LedgerEntry {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.amount === 'number' &&
    Number.isFinite(v.amount) &&
    typeof v.at === 'number'
  );
}

function isQuizRecord(v: unknown): v is QuizResultRecord {
  return (
    isObj(v) &&
    typeof v.at === 'number' &&
    typeof v.total === 'number' &&
    Array.isArray(v.correctFlags)
  );
}

function isBadgeUnlock(v: unknown): v is BadgeUnlock {
  return isObj(v) && typeof v.id === 'string' && typeof v.at === 'number';
}

function isDailyDay(v: unknown): v is DailyDay {
  return (
    isObj(v) &&
    typeof v.date === 'string' &&
    Array.isArray(v.tasks) &&
    v.tasks.every(isTask) &&
    Array.isArray(v.done) &&
    v.done.every((d) => typeof d === 'string')
  );
}

function statsOf(v: unknown): Stats {
  const base = emptyStats();
  if (!isObj(v)) return base;
  const out = { ...base };
  for (const key of Object.keys(base) as (keyof Stats)[]) {
    const fallback = base[key];
    if (fallback === null) {
      out[key] = (typeof v[key] === 'number' ? v[key] : null) as never;
    } else if (typeof fallback === 'number') {
      (out[key] as number) = Math.round(num(v[key], fallback, 0, 1_000_000));
    } else if (typeof fallback === 'string') {
      (out[key] as string | null) = typeof v[key] === 'string' ? v[key] : fallback;
    } else if (Array.isArray(fallback)) {
      (out[key] as string[]) = Array.isArray(v[key])
        ? (v[key] as unknown[]).filter((x): x is string => typeof x === 'string').slice(-400)
        : fallback;
    }
  }
  return out;
}

/** 宽松修复：无论输入多脏，都尽量产出可用存档 */
export function repairSave(raw: unknown, now: number = Date.now()): { save: SaveData; repaired: boolean } {
  const base = createDefaultSave(now);
  if (!isObj(raw)) return { save: base, repaired: true };
  let repaired = false;
  const flag = () => {
    repaired = true;
  };

  const schemaVersion = num(raw.schemaVersion, 1, 1, 999);
  if (schemaVersion !== SCHEMA_VERSION) flag();

  const xp = Math.round(num(raw.xp, 0, 0, 10_000_000));
  if (xp !== raw.xp) flag();

  const levelIndex = Math.round(num(raw.levelIndex, 0, 0, 23));
  if (levelIndex !== raw.levelIndex) flag();

  const lastQuiz = isQuizRecord(raw.lastQuiz)
    ? {
        at: num(raw.lastQuiz.at, now),
        date: str(raw.lastQuiz.date, todayKey(now)),
        questionIds: Array.isArray(raw.lastQuiz.questionIds)
          ? raw.lastQuiz.questionIds.filter((x): x is string => typeof x === 'string')
          : [],
        correctFlags: raw.lastQuiz.correctFlags.filter((x): x is boolean => typeof x === 'boolean'),
        correctCount: Math.round(num(raw.lastQuiz.correctCount, 0, 0, 99)),
        total: Math.round(num(raw.lastQuiz.total, ECONOMY.quizDrawCount, 1, 99)),
        percent: num(raw.lastQuiz.percent, 0, 0, 100),
        levelIndex: Math.round(num(raw.lastQuiz.levelIndex, 0, 0, 23)),
        axes: axesOf(raw.lastQuiz.axes),
        placement: bool(raw.lastQuiz.placement, true),
      }
    : null;

  const rawToday = raw.today;
  const today = isDailyDay(rawToday)
    ? {
        date: str(rawToday.date, todayKey(now)),
        tasks: rawToday.tasks.slice(0, DAILY_RULES.count),
        done: rawToday.done.filter((d) => rawToday.tasks.some((t) => t.id === d)),
        clearBonusGiven: bool(rawToday.clearBonusGiven),
      }
    : null;

  const save: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    salt: typeof raw.salt === 'string' && raw.salt.length >= 8 ? raw.salt : base.salt,
    nickname: typeof raw.nickname === 'string' ? Array.from(raw.nickname).slice(0, 16).join('') : '',
    createdAt: num(raw.createdAt, now, 0),
    updatedAt: num(raw.updatedAt, now, 0),
    xp,
    levelIndex,
    placed: bool(raw.placed, false),
    lastQuiz,
    quizHistory: safeArray(raw.quizHistory, isQuizRecord, 20),
    axes: axesOf(raw.axes),
    today,
    history: safeArray(raw.history, isDailyDay, 60),
    ledger: safeArray(raw.ledger, isLedgerEntry, 5000),
    badges: safeArray(raw.badges, isBadgeUnlock, 200),
    stats: statsOf(raw.stats),
    reduceMotion: bool(raw.reduceMotion, false),
    autoRepaired: false,
  };

  if (typeof raw.salt !== 'string' || raw.salt.length < 8) flag();
  save.autoRepaired = repaired;
  return { save, repaired };
}

/** 从任意版本迁移到当前版本（当前只有 v1→v2→v3 的历史占位） */
export function migrate(raw: Record<string, unknown>, now: number = Date.now()): { data: SaveData; migrated: boolean } {
  let working: Record<string, unknown> = { ...raw };
  let migrated = false;
  const version = num(working.schemaVersion, 1, 1, 999);

  // v1: 没有 stats.distinctDays，没有 ledger
  if (version < 2) {
    migrated = true;
    const stats = isObj(working.stats) ? { ...working.stats } : {};
    if (!Array.isArray(stats.distinctDays)) stats.distinctDays = [];
    working.stats = stats;
    if (!Array.isArray(working.ledger)) working.ledger = [];
    working.schemaVersion = 2;
  }

  // v2: 没有 reduceMotion / axe 数量上限
  if (num(working.schemaVersion, 2, 1, 999) < 3) {
    migrated = true;
    if (typeof working.reduceMotion !== 'boolean') working.reduceMotion = false;
    working.schemaVersion = 3;
  }

  const { save, repaired } = repairSave(working, now);
  return { data: save, migrated: migrated || repaired };
}

/**
 * 用账本重建可信经验值。
 * 账本是逐笔发放记录：如果存档里的 xp 大于账本总和，说明经验值被外部抬高，
 * 以账本为准回退（账本完整保留时它等价于经验来源审计）。
 */
function reconcileXp(save: SaveData): { save: SaveData; changed: boolean } {
  if (save.ledger.length === 0) return { save, changed: false };
  const ledgerSum = save.ledger.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
  if (save.xp <= ledgerSum) return { save, changed: false };
  const xp = Math.max(0, ledgerSum);
  let levelIndex = 0;
  for (const level of LEVELS) {
    if (xp >= level.minXp) levelIndex = level.index;
    else break;
  }
  return {
    save: { ...save, xp, levelIndex },
    changed: true,
  };
}

/**
 * 读取存档。顺序：主档 → 校验 → 失败则备份 → 失败则宽松修复 → 失败则安全模式。
 * 可传入自定义 store（测试用），默认使用 localStorage。
 */
export function loadSave(now: number = Date.now(), store: StorageLike | null = safeStorage()): LoadResult {
  if (!store) {
    return {
      save: createDefaultSave(now),
      status: 'corrupt',
      message: '当前浏览器禁用了本地存储，进度无法保存。你仍可以试玩，但刷新后会丢失。',
    };
  }

  const rawMain = store.getItem(STORAGE_KEY);
  if (rawMain === null) {
    return { save: createDefaultSave(now), status: 'fresh', message: '首次使用，已创建本地存档。' };
  }

  const tryParse = (text: string): { ok: true; data: SaveData; migrated: boolean } | { ok: false; reason: string } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: '存档不是合法 JSON（可能被截断）。' };
    }
    if (!isObj(parsed)) return { ok: false, reason: '存档结构不是对象。' };

    // 新格式：信封 + 校验和
    if (parsed.format === 'isr-save' && isObj(parsed.data)) {
      const expected = str(parsed.checksum);
      const actual = checksumOf(parsed.data);
      if (expected && expected !== actual) {
        return { ok: false, reason: '校验和不匹配（数据被外部修改或写入中断）。' };
      }
      const { data, migrated } = migrate(parsed.data as Record<string, unknown>, now);
      return { ok: true, data, migrated };
    }

    // 旧格式：直接是 SaveData（v1 以前）
    const { data, migrated } = migrate(parsed, now);
    return { ok: true, data, migrated };
  };

  const main = tryParse(rawMain);
  if (main.ok) {
    const reconciled = reconcileXp(main.data);
    if (reconciled.changed) {
      store.setItem(CORRUPT_KEY, rawMain);
      return {
        save: { ...reconciled.save, stats: { ...reconciled.save.stats, corruptRecoveries: reconciled.save.stats.corruptRecoveries + 1 } },
        status: 'repaired',
        message: '存档经验值与发放账本不一致（可能被外部修改），已按账本回退到可信经验。原始数据已另存。',
        rawCorrupt: rawMain,
      };
    }
    return {
      save: main.data,
      status: main.migrated ? 'migrated' : 'ok',
      message: main.migrated ? '存档已升级到最新版本。' : '存档读取成功。',
    };
  }

  // 尝试备份
  const rawBackup = store.getItem(BACKUP_KEY);
  if (rawBackup) {
    const backup = tryParse(rawBackup);
    if (backup.ok) {
      store.setItem(CORRUPT_KEY, rawMain);
      const reconciled = reconcileXp(backup.data);
      const save = {
        ...reconciled.save,
        stats: { ...reconciled.save.stats, corruptRecoveries: reconciled.save.stats.corruptRecoveries + 1 },
      };
      return {
        save,
        status: 'recovered-backup',
        message: `主存档损坏（${main.reason}），已从备份恢复。原始数据已另存。`,
        rawCorrupt: rawMain,
      };
    }
  }

  // 尝试宽松修复主档
  try {
    const parsed = JSON.parse(rawMain) as unknown;
    if (isObj(parsed)) {
      const inner = isObj(parsed.data) ? (parsed.data as Record<string, unknown>) : parsed;
      const { save: data } = repairSave(inner, now);
      if (data.xp > 0 || data.placed || isObj(inner.stats)) {
        store.setItem(CORRUPT_KEY, rawMain);
        const reconciled = reconcileXp(data);
        const save = { ...reconciled.save, stats: { ...reconciled.save.stats, corruptRecoveries: reconciled.save.stats.corruptRecoveries + 1 } };
        return {
          save,
          status: 'repaired',
          message: `主存档结构异常（${main.reason}），已尽可能修复${reconciled.changed ? '，并按账本回退可疑经验' : ''}。请检查段位与徽章是否符合预期。`,
          rawCorrupt: rawMain,
        };
      }
    }
  } catch {
    /* 忽略，进入安全模式 */
  }

  store.setItem(CORRUPT_KEY, rawMain);
  const fresh = createDefaultSave(now);
  return {
    save: fresh,
    status: 'corrupt',
    message: `存档无法读取（${main.reason}）。已保留原始数据，你可以先导出它，再决定是否重置。`,
    rawCorrupt: rawMain,
  };
}

/** 写入主档 + 备份（备份是上一份成功写入的内容） */
export function saveData(save: SaveData, store: StorageLike | null = safeStorage()): { ok: boolean; error?: string } {
  if (!store) return { ok: false, error: '本地存储不可用' };
  try {
    const prev = store.getItem(STORAGE_KEY);
    const envelope = wrapEnvelope({ ...save, updatedAt: Date.now() });
    const nextText = JSON.stringify(envelope);
    store.setItem(STORAGE_KEY, nextText);
    if (prev && prev !== nextText) store.setItem(BACKUP_KEY, prev);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** 导出：带 schemaVersion 与校验和，可读 JSON */
export function exportSave(save: SaveData): string {
  return JSON.stringify(
    {
      format: 'isr-save',
      schemaVersion: save.schemaVersion,
      exportedAt: new Date().toISOString(),
      checksum: checksumOf(save),
      data: save,
    },
    null,
    2,
  );
}

export type ImportResult =
  | { ok: true; save: SaveData; migrated: boolean; message: string }
  | { ok: false; message: string };

/** 导入：容忍旧版本、裸 SaveData、被包了一层的信封 */
export function importSave(text: string, now: number = Date.now()): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '文件不是合法 JSON，请确认选择的是本站导出的 .json。' };
  }
  if (!isObj(parsed)) return { ok: false, message: '文件内容不是对象。' };

  const isEnvelope = parsed.format === 'isr-save' && isObj(parsed.data);
  const inner = isEnvelope ? (parsed.data as Record<string, unknown>) : parsed;

  // 如果带校验和，先校验
  if (isEnvelope && typeof parsed.checksum === 'string' && parsed.checksum) {
    const actual = checksumOf(inner);
    if (parsed.checksum !== actual) {
      return { ok: false, message: '校验不通过：文件在传输过程中被修改，已拒绝导入。' };
    }
  }

  if (typeof inner.schemaVersion !== 'number' && typeof inner.xp !== 'number' && !isObj(inner.stats)) {
    return { ok: false, message: '这不像是本站的进度文件（缺少 schemaVersion / xp / stats）。' };
  }

  const { data, migrated } = migrate(inner, now);
  const version = num(inner.schemaVersion, 1, 1, 999);
  if (version > SCHEMA_VERSION) {
    return { ok: false, message: `文件来自更新版本（v${version}），当前只支持 v${SCHEMA_VERSION}。请升级页面后再导入。` };
  }
  return {
    ok: true,
    save: { ...data, stats: { ...data.stats, imports: data.stats.imports + 1 } },
    migrated,
    message: migrated ? '导入成功，并已完成版本迁移。' : '导入成功。',
  };
}

/** 清空所有本站键（重置） */
export function wipeStorage(store: StorageLike | null = safeStorage()): void {
  if (!store) return;
  for (const key of [STORAGE_KEY, BACKUP_KEY, CORRUPT_KEY, SETTINGS_KEY]) {
    store.removeItem(key);
  }
}

export function readCorruptRaw(): string | null {
  const store = safeStorage();
  return store ? store.getItem(CORRUPT_KEY) : null;
}

/** 内存版 Storage（自测用，模拟 localStorage 行为） */
export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}
