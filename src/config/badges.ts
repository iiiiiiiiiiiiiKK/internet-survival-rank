/**
 * 徽章配置（34 枚，唯一数据源）
 * ------------------------------------------------------------------
 * 每枚徽章只声明「指标 + 阈值」，由引擎统一评估，条件可解释、可测试。
 * 指标全部来自本地存档，不需要网络。
 */

import type { TierId } from './tiers';

export type BadgeCategory = 'rank' | 'quiz' | 'daily' | 'behavior' | 'collect' | 'secret';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legend';

/** 引擎可计算的指标名（见 src/lib/game.ts 的 computeMetrics） */
export type MetricKey =
  | 'placed'
  | 'levelIndex'
  | 'xp'
  | 'placementPercent'
  | 'placementCorrect'
  | 'quizRetakes'
  | 'tasksCompleted'
  | 'perfectDays'
  | 'bestStreak'
  | 'distinctDays'
  | 'nightTasks'
  | 'calmChoices'
  | 'offlineChoices'
  | 'fightChoices'
  | 'browseChoices'
  | 'spreadChoices'
  | 'judgeCorrect'
  | 'tapWins'
  | 'timerDone'
  | 'sharesSquare'
  | 'sharesTall'
  | 'imports'
  | 'resets'
  | 'corruptRecoveries'
  | 'tierListViews';

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  /** 像素图标字符 */
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  /** 解锁条件：指标 >= 阈值 */
  metric: MetricKey;
  gte: number;
  /** 取色用的段位 */
  tier: TierId;
  /** 未解锁时给出的提示 */
  hint: string;
}

export const BADGES: BadgeDef[] = [
  /* ---------------- 段位（8） ---------------- */
  { id: 'rank-bronze', name: '初次上线', desc: '完成首测，进入青铜段位。', icon: '🔌', category: 'rank', rarity: 'common', metric: 'placed', gte: 1, tier: 'bronze', hint: '完成首测即可。' },
  { id: 'rank-silver', name: '深夜有信号', desc: '到达白银段位。', icon: '🌙', category: 'rank', rarity: 'common', metric: 'levelIndex', gte: 3, tier: 'silver', hint: '累计经验达到 300。' },
  { id: 'rank-gold', name: '瓜田守望', desc: '到达黄金段位。', icon: '🍉', category: 'rank', rarity: 'rare', metric: 'levelIndex', gte: 6, tier: 'gold', hint: '累计经验达到 790。' },
  { id: 'rank-platinum', name: '搬运许可证', desc: '到达铂金段位。', icon: '📦', category: 'rank', rarity: 'rare', metric: 'levelIndex', gte: 9, tier: 'platinum', hint: '累计经验达到 1540。' },
  { id: 'rank-diamond', name: '键盘执照', desc: '到达钻石段位。', icon: '⌨️', category: 'rank', rarity: 'epic', metric: 'levelIndex', gte: 12, tier: 'diamond', hint: '累计经验达到 2600。' },
  { id: 'rank-master', name: '情报中枢', desc: '到达大师段位。', icon: '🛰️', category: 'rank', rarity: 'epic', metric: 'levelIndex', gte: 15, tier: 'master', hint: '累计经验达到 4060。' },
  { id: 'rank-grandmaster', name: '赛博老油条', desc: '到达宗师段位。', icon: '🔥', category: 'rank', rarity: 'legend', metric: 'levelIndex', gte: 18, tier: 'grandmaster', hint: '累计经验达到 6060。' },
  { id: 'rank-phantom', name: '查无此人', desc: '到达隐藏段位「互联网幽灵」。', icon: '👻', category: 'rank', rarity: 'legend', metric: 'levelIndex', gte: 21, tier: 'phantom', hint: '累计经验达到 8800。' },

  /* ---------------- 首测（4） ---------------- */
  { id: 'quiz-first', name: '第一次触网', desc: '完成首次 14 题段位测试（无论答对多少）。', icon: '🎮', category: 'quiz', rarity: 'common', metric: 'placed', gte: 1, tier: 'bronze', hint: '完成首测即可。' },
  { id: 'quiz-sharp', name: '雷达校准', desc: '首测正确率达到 80%。', icon: '📡', category: 'quiz', rarity: 'rare', metric: 'placementPercent', gte: 80, tier: 'platinum', hint: '14 题里至少答对 12 题。' },
  { id: 'quiz-perfect', name: '一次都没被骗', desc: '首测拿到满分。', icon: '💯', category: 'quiz', rarity: 'legend', metric: 'placementPercent', gte: 100, tier: 'phantom', hint: '14 题全对。' },
  { id: 'quiz-retake', name: '再来一次', desc: '累计重测 3 次。', icon: '🔁', category: 'quiz', rarity: 'common', metric: 'quizRetakes', gte: 3, tier: 'silver', hint: '在个人主页发起重测。' },

  /* ---------------- 每日挑战（9） ---------------- */
  { id: 'daily-first', name: '今日已签到', desc: '完成第一个每日任务。', icon: '✅', category: 'daily', rarity: 'common', metric: 'tasksCompleted', gte: 1, tier: 'bronze', hint: '去每日挑战做一题。' },
  { id: 'daily-10', name: '日常出勤', desc: '累计完成 10 个每日任务。', icon: '🗓️', category: 'daily', rarity: 'common', metric: 'tasksCompleted', gte: 10, tier: 'silver', hint: '大约 4 天的量。' },
  { id: 'daily-30', name: '月度全勤', desc: '累计完成 30 个每日任务。', icon: '📅', category: 'daily', rarity: 'rare', metric: 'tasksCompleted', gte: 30, tier: 'gold', hint: '连续挑战也能累计。' },
  { id: 'daily-60', name: '全勤不动摇', desc: '累计完成 60 个每日任务。', icon: '🏅', category: 'daily', rarity: 'epic', metric: 'tasksCompleted', gte: 60, tier: 'diamond', hint: '大约 20 天全清。' },
  { id: 'daily-clear1', name: '今日清空', desc: '首次完成一天的全部 3 个任务。', icon: '🧹', category: 'daily', rarity: 'common', metric: 'perfectDays', gte: 1, tier: 'silver', hint: '同一天把 3 个任务都做完。' },
  { id: 'daily-clear7', name: '七日全清', desc: '累计 7 天完成全部任务。', icon: '🌈', category: 'daily', rarity: 'epic', metric: 'perfectDays', gte: 7, tier: 'master', hint: '每天都要把 3 个任务做完。' },
  { id: 'streak-3', name: '三日不断网', desc: '连续挑战 3 天。', icon: '🔗', category: 'daily', rarity: 'common', metric: 'bestStreak', gte: 3, tier: 'silver', hint: '连续三天完成任务。' },
  { id: 'streak-7', name: '一周在线', desc: '连续挑战 7 天。', icon: '🧭', category: 'daily', rarity: 'rare', metric: 'bestStreak', gte: 7, tier: 'gold', hint: '别断就行。' },
  { id: 'streak-14', name: '两周不塌房', desc: '连续挑战 14 天。', icon: '🏰', category: 'daily', rarity: 'legend', metric: 'bestStreak', gte: 14, tier: 'grandmaster', hint: '连续两周完成任务。' },

  /* ---------------- 行为（7） ---------------- */
  { id: 'calm-10', name: '血压稳定', desc: '在行为选择中累计 10 次选择"先核实"。', icon: '🧘', category: 'behavior', rarity: 'rare', metric: 'calmChoices', gte: 10, tier: 'platinum', hint: '每日的「血压管理」类任务。' },
  { id: 'offline-10', name: '已读不回', desc: '累计 10 次选择先离开信息流。', icon: '🚪', category: 'behavior', rarity: 'rare', metric: 'offlineChoices', gte: 10, tier: 'gold', hint: '每日选择类任务里点"划走"。' },
  { id: 'judge-10', name: '转发守门员', desc: '判断类任务累计答对 10 次。', icon: '🚦', category: 'behavior', rarity: 'rare', metric: 'judgeCorrect', gte: 10, tier: 'diamond', hint: '每天最多 1 次机会。' },
  { id: 'tap-5', name: '手速上线', desc: '手速挑战累计成功 5 次。', icon: '⚡', category: 'behavior', rarity: 'rare', metric: 'tapWins', gte: 5, tier: 'gold', hint: '限时点掉全部弹窗。' },
  { id: 'timer-5', name: '离线练习', desc: '离线计时任务累计完成 5 次。', icon: '🌿', category: 'behavior', rarity: 'common', metric: 'timerDone', gte: 5, tier: 'silver', hint: '耐心等计时结束。' },
  { id: 'night-5', name: '凌晨三点观察员', desc: '在 0:00-5:00 完成任务 5 次。', icon: '🦉', category: 'behavior', rarity: 'epic', metric: 'nightTasks', gte: 5, tier: 'master', hint: '深夜打开本站。' },
  { id: 'xp-3000', name: '经验值富翁', desc: '累计获得 3000 经验值。', icon: '💠', category: 'behavior', rarity: 'epic', metric: 'xp', gte: 3000, tier: 'diamond', hint: '持续完成挑战。' },

  /* ---------------- 收集与彩蛋（6） ---------------- */
  { id: 'share-square', name: '方形名片', desc: '下载一张 1:1 段位卡。', icon: '🖼️', category: 'collect', rarity: 'common', metric: 'sharesSquare', gte: 1, tier: 'platinum', hint: '在段位卡页面选择 1:1。' },
  { id: 'share-tall', name: '竖版海报', desc: '下载一张 3:4 段位卡。', icon: '📱', category: 'collect', rarity: 'common', metric: 'sharesTall', gte: 1, tier: 'platinum', hint: '在段位卡页面选择 3:4。' },
  { id: 'import-1', name: '搬家成功', desc: '导入一次本地进度文件。', icon: '📥', category: 'collect', rarity: 'common', metric: 'imports', gte: 1, tier: 'gold', hint: '在设置里导入 JSON。' },
  { id: 'recover-1', name: '数据外科医生', desc: '从一次存档损坏中恢复。', icon: '🩺', category: 'secret', rarity: 'epic', metric: 'corruptRecoveries', gte: 1, tier: 'diamond', hint: '触发损坏保护后恢复备份。' },
  { id: 'reset-1', name: '重新做人', desc: '主动重置一次全部进度。', icon: '🧯', category: 'secret', rarity: 'common', metric: 'resets', gte: 1, tier: 'silver', hint: '设置里有重置按钮。' },
  { id: 'tierlist-1', name: '段位研究员', desc: '查看完整段位表。', icon: '🗺️', category: 'collect', rarity: 'common', metric: 'tierListViews', gte: 1, tier: 'gold', hint: '打开首页的段位表。' },
];

export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  rank: '段位',
  quiz: '首测',
  daily: '每日',
  behavior: '行为',
  collect: '收集',
  secret: '彩蛋',
};

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legend: '传说',
};

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);
