/**
 * 测试统一出口：把浏览器无关的纯逻辑重新导出，供 scripts/selftest.mjs 使用。
 * 不包含任何 React 组件，也不访问 DOM / localStorage（除显式传入的 store）。
 */

export {
  TIERS,
  LEVELS,
  MAX_LEVEL_INDEX,
  PLACEMENT_BANDS,
  placementLevelIndex,
  getTier,
} from '../config/tiers';
export { ECONOMY, streakBonus, theoreticalDailyMax, placementXp } from '../config/economy';
export { BADGES, BADGE_CATEGORY_LABEL, RARITY_LABEL } from '../config/badges';
export {
  QUIZ_QUESTIONS,
  QUIZ_DRAW_COUNT,
  AXES,
} from '../config/quiz';
export { DAILY_TEMPLATES, JUDGE_ITEMS, TASK_TYPE_LABEL, DAILY_RULES } from '../config/daily';
export { CARD_SIZES, cardText } from '../lib/card';
export {
  mulberry32,
  hashSeed,
  shuffle,
  levelFromXp,
  levelProgress,
  tierProgress,
  tierName,
  axesPercent,
  dominantAxis,
  DOMINANT_LABEL,
  drawPlacementQuestions,
  scorePlacement,
  applyQuizResult,
  generateDailyTasks,
  ensureToday,
  xpEarnedOn,
  completeTask,
  computeMetrics,
  unlockedBadgeIds,
  evaluateBadges,
  badgeProgress,
  touchStat,
  resetProgress,
  nextLevelHint,
  tierTable,
  rankSummary,
  placementExplain,
  badgeCountByCategory,
} from '../lib/game';
export {
  SCHEMA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  CORRUPT_KEY,
  createDefaultSave,
  createMemoryStorage,
  todayKey,
  daysBetween,
  checksumOf,
  stableStringify,
  wrapEnvelope,
  repairSave,
  migrate,
  loadSave,
  saveData,
  exportSave,
  importSave,
  wipeStorage,
} from '../lib/storage';

import { loadSave as _loadSave } from '../lib/storage';
import type { StorageLike } from '../lib/storage';

/** 测试便捷函数：从自定义 store 读取 */
export function loadSaveFrom(store: StorageLike) {
  return _loadSave(Date.now(), store);
}
