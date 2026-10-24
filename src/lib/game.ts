/**
 * 游戏引擎（纯函数，可单测）
 * ------------------------------------------------------------------
 * 所有状态变更都返回新对象，不做副作用；读写由 React 层负责。
 * 关键不变量：
 *   xp >= 0 且 levelIndex 永远由 xp 推导；
 *   任何一条经验收入都必须有唯一 ledger id，重复 id 直接拒绝；
 *   同一任务每天只能结算一次（id 含日期）。
 */

import { BADGES, type BadgeDef, type MetricKey } from '../config/badges';
import { DAILY_RULES, DAILY_TEMPLATES, JUDGE_ITEMS, type DailyTemplate } from '../config/daily';
import { ECONOMY, placementXp, streakBonus } from '../config/economy';
import { QUIZ_QUESTIONS, type QuizQuestion } from '../config/quiz';
import {
  LEVELS,
  MAX_LEVEL_INDEX,
  PLACEMENT_BANDS,
  TIERS,
  getTier,
  placementLevelIndex,
  type LevelDef,
  type TierId,
} from '../config/tiers';
import {
  daysBetween,
  todayKey,
  type Axes,
  type BadgeUnlock,
  type DailyDay,
  type DailyTask,
  type LedgerEntry,
  type QuizResultRecord,
  type SaveData,
} from './storage';

/* ------------------------------------------------------------------ */
/* 随机（可复现）                                                      */
/* ------------------------------------------------------------------ */

/** mulberry32：同一个种子永远得到同一序列，用于每日任务 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字符串 → 32 位种子 */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 等级与进度                                                          */
/* ------------------------------------------------------------------ */

export function levelFromXp(xp: number): LevelDef {
  let found = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXp) found = level;
    else break;
  }
  return found;
}

export interface LevelProgress {
  level: LevelDef;
  tier: ReturnType<typeof getTier>;
  /** 下一级（满级时为 null） */
  next: LevelDef | null;
  /** 当前等级内已获得经验 */
  into: number;
  /** 当前等级需要的经验跨度 */
  span: number;
  /** 0-100 的百分比（整数，便于展示） */
  percent: number;
  /** 距离下一级还差多少 */
  remaining: number;
  isMax: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const tier = getTier(level.tierId);
  const nextLevel = LEVELS[level.index + 1] ?? null;
  const span = nextLevel ? nextLevel.minXp - level.minXp : 1;
  const into = Math.max(0, xp - level.minXp);
  const percent = nextLevel ? Math.max(0, Math.min(100, Math.round((into / span) * 100))) : 100;
  return {
    level,
    tier,
    next: nextLevel,
    into,
    span,
    percent,
    remaining: nextLevel ? Math.max(0, nextLevel.minXp - xp) : 0,
    isMax: level.index === MAX_LEVEL_INDEX,
  };
}

/** 段位整体进度：当前段位三级中的位置，用于分享卡 */
export function tierProgress(xp: number): { tier: TierId; step: number; percent: number } {
  const { level, tier } = levelProgress(xp);
  const first = getTier(level.tierId).thresholds[0];
  const last = getTier(level.tierId).thresholds[2];
  const span = Math.max(1, last - first);
  const percent = level.index === MAX_LEVEL_INDEX ? 100 : Math.round(((xp - first) / span) * 100);
  return { tier: tier.id, step: level.step, percent: Math.max(0, Math.min(100, percent)) };
}

export function tierName(tierId: TierId): string {
  return getTier(tierId).name;
}

/** 属性归一化成 0-100 */
export function axesPercent(axes: Axes): Axes {
  const total = axes.info + axes.social + axes.vibe;
  if (total <= 0) return { info: 0, social: 0, vibe: 0 };
  return {
    info: Math.round((axes.info / total) * 100),
    social: Math.round((axes.social / total) * 100),
    vibe: Math.round((axes.vibe / total) * 100),
  };
}

/** 由三维属性推出一个「主属性」标签 */
export function dominantAxis(axes: Axes): 'info' | 'social' | 'vibe' {
  const entries: [Axes[keyof Axes], 'info' | 'social' | 'vibe'][] = [
    [axes.info, 'info'],
    [axes.social, 'social'],
    [axes.vibe, 'vibe'],
  ];
  entries.sort((a, b) => b[0] - a[0]);
  return entries[0][1];
}

export const DOMINANT_LABEL = {
  info: '信息雷达型',
  social: '社交电量型',
  vibe: '赛博松弛型',
} as const;

/* ------------------------------------------------------------------ */
/* 首测                                                                */
/* ------------------------------------------------------------------ */

export interface PlacementQuestion extends QuizQuestion {
  /** 选项展示顺序（打乱后），用于 UI */
  order: number[];
}

/** 抽 14 题，并打乱每题选项顺序 */
export function drawPlacementQuestions(rand: () => number = Math.random): PlacementQuestion[] {
  const picked = shuffle(QUIZ_QUESTIONS, rand).slice(0, ECONOMY.quizDrawCount);
  return picked.map((q) => ({
    ...q,
    order: shuffle([0, 1, 2], rand),
  }));
}

export interface QuizAnswer {
  questionId: string;
  /** 原始选项下标（0-2，对应 q.options） */
  optionIndex: number;
}

export interface QuizScore {
  correctCount: number;
  total: number;
  percent: number;
  correctFlags: boolean[];
  axes: Axes;
  levelIndex: number;
  /** 建议的基础经验（起点门槛） */
  baseXp: number;
}

/** 计算首测得分：分数决定起点等级，选项归属决定三维属性 */
export function scorePlacement(answers: QuizAnswer[]): QuizScore {
  let correctCount = 0;
  const axes: Axes = { info: 0, social: 0, vibe: 0 };
  const correctFlags: boolean[] = [];

  for (const answer of answers) {
    const question = QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
    if (!question) {
      correctFlags.push(false);
      continue;
    }
    const option = question.options[answer.optionIndex];
    if (!option) {
      correctFlags.push(false);
      continue;
    }
    axes[option.axis] += 1;
    correctFlags.push(option.correct);
    if (option.correct) correctCount += 1;
  }

  const total = answers.length || 1;
  const percent = Math.round((correctCount / total) * 100);
  const levelIndex = placementLevelIndex(percent);
  return {
    correctCount,
    total: answers.length,
    percent,
    correctFlags,
    axes,
    levelIndex,
    baseXp: LEVELS[levelIndex].minXp,
  };
}

export interface ApplyQuizOutcome {
  save: SaveData;
  record: QuizResultRecord;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: BadgeUnlock[];
  /** 是否发放了经验（重测不发） */
  rewarded: boolean;
}

/**
 * 应用一次测试结果。
 * 首测：写入起点经验（只此一次）；重测：只更新称号、属性和历史，不发经验。
 */
export function applyQuizResult(
  save: SaveData,
  score: QuizScore,
  answers: QuizAnswer[],
  now: number = Date.now(),
): ApplyQuizOutcome {
  const placement = !save.placed;
  const levelBefore = levelFromXp(save.xp).index;
  let xp = save.xp;
  let rewarded = false;
  let nextSave: SaveData = { ...save };
  const ledger = save.ledger.slice();

  if (placement) {
    const nextLevel = LEVELS[score.levelIndex + 1];
    const startXp = placementXp(score.baseXp, nextLevel ? nextLevel.minXp : score.baseXp, score.correctCount / Math.max(1, score.total));
    const amount = Math.max(0, startXp - xp);
    if (amount > 0) {
      xp += amount;
      ledger.push({ id: 'placement', at: now, amount, label: '首测段位结算' });
      rewarded = true;
    } else if (!ledger.some((e) => e.id === 'placement')) {
      ledger.push({ id: 'placement', at: now, amount: 0, label: '首测段位结算' });
    }
    nextSave = { ...nextSave, placed: true };
  } else {
    nextSave = { ...nextSave, stats: { ...nextSave.stats, quizRetakes: nextSave.stats.quizRetakes + 1 } };
  }

  const record: QuizResultRecord = {
    at: now,
    date: todayKey(now),
    questionIds: answers.map((a) => a.questionId),
    correctFlags: score.correctFlags,
    correctCount: score.correctCount,
    total: score.total,
    percent: score.percent,
    levelIndex: score.levelIndex,
    axes: score.axes,
    placement,
  };

  const history = [record, ...nextSave.quizHistory].slice(0, 20);
  const levelAfter = levelFromXp(xp).index;
  const candidate: SaveData = {
    ...nextSave,
    xp,
    levelIndex: levelAfter,
    lastQuiz: record,
    quizHistory: history,
    axes: score.axes,
    ledger,
    updatedAt: now,
  };

  const evaluated = evaluateBadges(candidate, now);
  return {
    save: evaluated.save,
    record,
    xpGained: xp - save.xp,
    levelBefore,
    levelAfter,
    newBadges: evaluated.newBadges,
    rewarded,
  };
}

/* ------------------------------------------------------------------ */
/* 每日任务                                                            */
/* ------------------------------------------------------------------ */

/** 由「日期 + 安装盐」确定性地生成当天 3 个任务 */
export function generateDailyTasks(date: string, salt: string): DailyTask[] {
  const rand = mulberry32(hashSeed(`${date}|${salt}`));
  const byType = new Map<DailyTemplate['type'], DailyTemplate[]>();
  for (const tpl of DAILY_TEMPLATES) {
    const list = byType.get(tpl.type) ?? [];
    list.push(tpl);
    byType.set(tpl.type, list);
  }
  const types = shuffle([...byType.keys()], rand).slice(0, DAILY_RULES.count);
  const judgePool = shuffle(JUDGE_ITEMS, rand);

  return types.map((type, index) => {
    const pool = byType.get(type) ?? [];
    const tpl = pool[Math.floor(rand() * pool.length) % pool.length];
    const task: DailyTask = {
      id: `${date}:${tpl.id}`,
      templateId: tpl.id,
      type: tpl.type,
      title: tpl.title,
      desc: tpl.desc,
      xp: tpl.xp,
      glyph: tpl.glyph,
    };
    if (tpl.options) task.options = tpl.options.map((o) => ({ text: o.text, tag: o.tag }));
    if (tpl.targets) task.targets = tpl.targets;
    if (tpl.timeLimitMs) task.timeLimitMs = tpl.timeLimitMs;
    if (tpl.seconds) task.seconds = tpl.seconds;
    if (tpl.type === 'judge') {
      task.judgeId = judgePool[index % judgePool.length].id;
    }
    return task;
  });
}

/**
 * 保证 save.today 对应当前本地日期：
 * - 日期变了：旧的一天归档进 history，生成新的一天；
 * - 日期回到过去（改时区/改系统时间）：优先复用 history 中那一天的记录，避免重复奖励。
 */
export function ensureToday(save: SaveData, now: number = Date.now()): SaveData {
  const date = todayKey(now);
  if (save.today && save.today.date === date) return save;

  const previous = save.today;
  const history = save.history.slice();
  if (previous && previous.done.length > 0) {
    const idx = history.findIndex((d) => d.date === previous.date);
    if (idx >= 0) history[idx] = previous;
    else history.unshift(previous);
  }

  const archived = history.slice(0, 60);
  const existing = archived.find((d) => d.date === date);
  const today: DailyDay = existing
    ? { ...existing, tasks: existing.tasks.length === DAILY_RULES.count ? existing.tasks : generateDailyTasks(date, save.salt) }
    : { date, tasks: generateDailyTasks(date, save.salt), done: [], clearBonusGiven: false };

  return {
    ...save,
    today,
    history: archived.filter((d) => d.date !== date),
    updatedAt: now,
  };
}

/** 今日已获得的经验（用账本统计，防重复/超发） */
export function xpEarnedOn(save: SaveData, date: string): number {
  return save.ledger
    .filter((e) => e.id.split(':').includes(date))
    .reduce((sum, e) => sum + e.amount, 0);
}

export interface TaskCompletionInput {
  taskId: string;
  /** choice 型：选中的选项下标；judge 型：用户判断的值；tap/timer：可选 */
  value?: boolean | number;
  /** 表现系数：1 = 全奖，0.5 = 半奖 */
  multiplier?: number;
  now?: number;
}

export type TaskRejectReason = 'not-today' | 'already-done' | 'daily-cap' | 'unknown-task';

export interface TaskOutcome {
  save: SaveData;
  accepted: boolean;
  reason?: TaskRejectReason;
  xpGained: number;
  bonusXp: number;
  newBadges: BadgeUnlock[];
  levelBefore: number;
  levelAfter: number;
  /** 连续挑战天数（本次结算后的值，仅在当天首个任务时变化） */
  streak: number;
  perfectDay: boolean;
}

const STAT_BY_TAG: Partial<Record<string, keyof SaveData['stats']>> = {
  calm: 'calmChoices',
  offline: 'offlineChoices',
  fight: 'fightChoices',
  browse: 'browseChoices',
  spread: 'spreadChoices',
};

/**
 * 结算一个每日任务。
 * 同一个任务 id 每天只可能成功一次（done 列表 + 账本双重校验）。
 */
export function completeTask(save: SaveData, input: TaskCompletionInput): TaskOutcome {
  const now = input.now ?? Date.now();
  const levelBefore = levelFromXp(save.xp).index;
  const current = ensureToday(save, now);
  const today = current.today;
  const base: TaskOutcome = {
    save: current,
    accepted: false,
    xpGained: 0,
    bonusXp: 0,
    newBadges: [],
    levelBefore,
    levelAfter: levelBefore,
    streak: current.stats.currentStreak,
    perfectDay: false,
  };
  if (!today) return { ...base, reason: 'unknown-task' };

  const task = today.tasks.find((t) => t.id === input.taskId);
  if (!task) return { ...base, reason: 'unknown-task' };
  if (today.done.includes(task.id)) return { ...base, reason: 'already-done' };
  if (current.ledger.some((e) => e.id === `task:${task.id}`)) return { ...base, reason: 'already-done' };

  const multiplier = Math.max(0, Math.min(1, input.multiplier ?? 1));
  const taskXp = Math.round(task.xp * multiplier);
  const earnedToday = xpEarnedOn(current, today.date);
  const room = Math.max(0, ECONOMY.dailyXpCap - earnedToday);
  const ledger: LedgerEntry[] = current.ledger.slice();
  let gained = Math.min(taskXp, room);
  if (taskXp > 0 && gained < taskXp) {
    // 达到单日上限：仍记录任务完成，但只记实际发放的经验
    ledger.push({ id: `task:${task.id}`, at: now, amount: gained, label: `${task.title}（今日经验已达上限）` });
  } else {
    ledger.push({ id: `task:${task.id}`, at: now, amount: gained, label: task.title });
  }

  const stats = { ...current.stats };
  let streak = stats.currentStreak;
  let bonusXp = 0;
  let perfectDay = false;

  // 连续挑战：当天第一个完成的任务触发一次
  const isFirstToday = today.done.length === 0;
  if (isFirstToday) {
    const last = stats.lastActiveDate;
    if (last === today.date) {
      streak = Math.max(1, streak);
    } else if (last && daysBetween(last, today.date) === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
    stats.currentStreak = streak;
    stats.bestStreak = Math.max(stats.bestStreak, streak);
    stats.lastActiveDate = today.date;
    if (!stats.distinctDays.includes(today.date)) {
      stats.distinctDays = [...stats.distinctDays, today.date].slice(-400);
    }
    const streakXp = Math.min(streakBonus(streak), Math.max(0, room - gained));
    if (streakXp > 0 && !current.ledger.some((e) => e.id === `streak:${today.date}`)) {
      ledger.push({ id: `streak:${today.date}`, at: now, amount: streakXp, label: `连续挑战 ${streak} 天` });
      bonusXp += streakXp;
      gained += streakXp;
    }
  }

  // 行为统计
  if (task.type === 'choice' && typeof input.value === 'number') {
    const tag = task.options?.[input.value]?.tag;
    const key = tag ? STAT_BY_TAG[tag] : undefined;
    if (key && typeof stats[key] === 'number') {
      (stats[key] as number) += 1;
    }
  }
  if (task.type === 'judge') {
    if (input.value === true) stats.judgeCorrect += 1;
  }
  if (task.type === 'tap') {
    if (input.value === true) stats.tapWins += 1;
  }
  if (task.type === 'timer') stats.timerDone += 1;

  const hour = new Date(now).getHours();
  if (hour >= 0 && hour < 5) stats.nightTasks += 1;

  stats.tasksCompleted += 1;

  const done = [...today.done, task.id];
  let clearBonusGiven = today.clearBonusGiven;
  if (done.length >= today.tasks.length && !today.clearBonusGiven) {
    const clearXp = Math.min(ECONOMY.dailyClearBonus, Math.max(0, ECONOMY.dailyXpCap - xpEarnedOn({ ...current, ledger } as SaveData, today.date)));
    if (clearXp > 0 && !current.ledger.some((e) => e.id === `clear:${today.date}`)) {
      ledger.push({ id: `clear:${today.date}`, at: now, amount: clearXp, label: '今日任务全清' });
      bonusXp += clearXp;
      gained += clearXp;
    }
    clearBonusGiven = true;
    perfectDay = true;
    stats.perfectDays += 1;
  }

  const nextToday: DailyDay = { ...today, done, clearBonusGiven };
  const history = current.history.map((d) => (d.date === today.date ? nextToday : d));
  const xp = current.xp + gained;
  const levelAfter = levelFromXp(xp).index;

  const candidate: SaveData = {
    ...current,
    xp,
    levelIndex: levelAfter,
    today: nextToday,
    history,
    ledger,
    stats,
    updatedAt: now,
  };

  const evaluated = evaluateBadges(candidate, now);
  return {
    save: evaluated.save,
    accepted: true,
    xpGained: gained,
    bonusXp,
    newBadges: evaluated.newBadges,
    levelBefore,
    levelAfter,
    streak,
    perfectDay,
  };
}

/* ------------------------------------------------------------------ */
/* 徽章与指标                                                          */
/* ------------------------------------------------------------------ */

export function computeMetrics(save: SaveData): Record<MetricKey, number> {
  const placement = save.lastQuiz?.placement ? save.lastQuiz : null;
  return {
    placed: save.placed ? 1 : 0,
    levelIndex: levelFromXp(save.xp).index,
    xp: save.xp,
    placementPercent: placement ? placement.percent : 0,
    placementCorrect: placement ? placement.correctCount : 0,
    quizRetakes: save.stats.quizRetakes,
    tasksCompleted: save.stats.tasksCompleted,
    perfectDays: save.stats.perfectDays,
    bestStreak: save.stats.bestStreak,
    distinctDays: save.stats.distinctDays.length,
    nightTasks: save.stats.nightTasks,
    calmChoices: save.stats.calmChoices,
    offlineChoices: save.stats.offlineChoices,
    fightChoices: save.stats.fightChoices,
    browseChoices: save.stats.browseChoices,
    spreadChoices: save.stats.spreadChoices,
    judgeCorrect: save.stats.judgeCorrect,
    tapWins: save.stats.tapWins,
    timerDone: save.stats.timerDone,
    sharesSquare: save.stats.sharesSquare,
    sharesTall: save.stats.sharesTall,
    imports: save.stats.imports,
    resets: save.stats.resets,
    corruptRecoveries: save.stats.corruptRecoveries,
    tierListViews: save.stats.tierListViews,
  };
}

export function unlockedBadgeIds(save: SaveData): Set<string> {
  return new Set(save.badges.map((b) => b.id));
}

/** 检查所有徽章，返回新增解锁的列表（按配置顺序） */
export function evaluateBadges(
  save: SaveData,
  now: number = Date.now(),
): { save: SaveData; newBadges: BadgeUnlock[] } {
  const metrics = computeMetrics(save);
  const owned = unlockedBadgeIds(save);
  const newBadges: BadgeUnlock[] = [];
  for (const badge of BADGES) {
    if (owned.has(badge.id)) continue;
    if ((metrics[badge.metric] ?? 0) >= badge.gte) {
      newBadges.push({ id: badge.id, at: now });
    }
  }
  if (newBadges.length === 0) return { save, newBadges };
  return { save: { ...save, badges: [...save.badges, ...newBadges], updatedAt: now }, newBadges };
}

export function badgeProgress(save: SaveData, badge: BadgeDef): { current: number; target: number; percent: number; unlocked: boolean } {
  const metrics = computeMetrics(save);
  const current = metrics[badge.metric] ?? 0;
  const unlocked = save.badges.some((b) => b.id === badge.id);
  const percent = Math.max(0, Math.min(100, Math.round((current / Math.max(1, badge.gte)) * 100)));
  return { current, target: badge.gte, percent: unlocked ? 100 : percent, unlocked };
}

/* ------------------------------------------------------------------ */
/* 进度操作                                                            */
/* ------------------------------------------------------------------ */

export function touchStat(
  save: SaveData,
  key: 'sharesSquare' | 'sharesTall' | 'tierListViews' | 'imports' | 'corruptRecoveries',
  now: number = Date.now(),
): { save: SaveData; newBadges: BadgeUnlock[] } {
  const stats = { ...save.stats, [key]: save.stats[key] + 1 };
  const candidate: SaveData = { ...save, stats, updatedAt: now };
  return evaluateBadges(candidate, now);
}

/** 重置：保留 reset 计数与损坏恢复计数，让"重新做人"徽章仍可解锁 */
export interface ResetOutcome {
  save: SaveData;
  newBadges: BadgeUnlock[];
}

export function resetProgress(save: SaveData, now: number = Date.now(), keepStats = true): ResetOutcome {
  const fresh = createResetSave(save, now, keepStats);
  const evaluated = evaluateBadges(fresh, now);
  return { save: evaluated.save, newBadges: evaluated.newBadges };
}

function createResetSave(save: SaveData, now: number, keepStats: boolean): SaveData {
  const stats = save.stats;
  return {
    schemaVersion: save.schemaVersion,
    salt: save.salt,
    nickname: save.nickname,
    createdAt: save.createdAt,
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
    stats: {
      ...emptyStatsLike(save.stats),
      resets: (keepStats ? stats.resets : 0) + 1,
      corruptRecoveries: keepStats ? stats.corruptRecoveries : 0,
      // 重置后当天仍可重新挑战，所以连续天数归零
      currentStreak: 0,
      lastActiveDate: null,
      lastResetAt: now,
    },
    reduceMotion: save.reduceMotion,
    autoRepaired: false,
  };
}

function emptyStatsLike(stats: SaveData['stats']): SaveData['stats'] {
  return {
    ...stats,
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
    corruptRecoveries: stats.corruptRecoveries,
    tierListViews: 0,
    quizRetakes: 0,
    lastResetAt: stats.lastResetAt,
  };
}

/* ------------------------------------------------------------------ */
/* 展示辅助                                                            */
/* ------------------------------------------------------------------ */

/** 用于首页「下一级还差多少」 */
export function nextLevelHint(xp: number): string {
  const progress = levelProgress(xp);
  if (progress.isMax) return '已达最高等级';
  return `距离 ${progress.next?.title ?? '下一级'} 还差 ${progress.remaining} 经验`;
}

/** 段位表：未解锁的隐藏段位显示 ??? */
export function tierTable(xp: number, unlockedPhantom: boolean) {
  const current = levelProgress(xp);
  return TIERS.map((tier) => {
    const levels = LEVELS.filter((l) => l.tierId === tier.id);
    const hidden = Boolean(tier.hidden) && !unlockedPhantom;
    return {
      tier,
      levels,
      hidden,
      unlocked: levels.some((l) => l.minXp <= xp),
      isCurrent: tier.id === current.tier.id,
      currentStep: tier.id === current.tier.id ? current.level.step : 0,
    };
  });
}

/** 分享卡需要的摘要数据（纯数据，方便测试） */
export interface RankSummary {
  tierName: string;
  tierEpithet: string;
  levelTitle: string;
  levelLabel: string;
  step: number;
  xp: number;
  percent: number;
  remaining: number;
  nextTitle: string | null;
  badgeCount: number;
  totalBadges: number;
  streak: number;
  tasksDone: number;
  axes: Axes;
  dominant: 'info' | 'social' | 'vibe';
  dominantLabel: string;
  isMax: boolean;
  tierColor: string;
  tierColorDark: string;
}

export function rankSummary(save: SaveData): RankSummary {
  const progress = levelProgress(save.xp);
  const axes = axesPercent(save.axes);
  const dominant = dominantAxis(save.axes);
  return {
    tierName: progress.tier.name,
    tierEpithet: progress.tier.epithet,
    levelTitle: progress.level.title,
    levelLabel: `${progress.tier.name} ${progress.level.roman}`,
    step: progress.level.step,
    xp: save.xp,
    percent: progress.percent,
    remaining: progress.remaining,
    nextTitle: progress.next?.title ?? null,
    badgeCount: save.badges.length,
    totalBadges: BADGES.length,
    streak: save.stats.currentStreak,
    tasksDone: save.stats.tasksCompleted,
    axes,
    dominant,
    dominantLabel: DOMINANT_LABEL[dominant],
    isMax: progress.isMax,
    tierColor: progress.tier.color,
    tierColorDark: progress.tier.colorDark,
  };
}

/** 供 UI 展示的「为什么是这个段位」解释 */
export function placementExplain(score: QuizScore): string {
  const band = [...PLACEMENT_BANDS].reverse().find((b) => b.minPercent <= score.percent) ?? PLACEMENT_BANDS[0];
  return `答对 ${score.correctCount}/${score.total}（${score.percent}%），落在「正确率 ≥ ${band.minPercent}%」档位，因此起点是 ${LEVELS[score.levelIndex].title}。`;
}

/** 每个等级的徽章数（个人页用） */
export function badgeCountByCategory(save: SaveData): Record<string, { owned: number; total: number }> {
  const owned = unlockedBadgeIds(save);
  const out: Record<string, { owned: number; total: number }> = {};
  for (const badge of BADGES) {
    const entry = out[badge.category] ?? { owned: 0, total: 0 };
    entry.total += 1;
    if (owned.has(badge.id)) entry.owned += 1;
    out[badge.category] = entry;
  }
  return out;
}

