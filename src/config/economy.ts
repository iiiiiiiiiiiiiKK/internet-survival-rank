/**
 * 娱乐化积分规则（唯一数据源）
 * ------------------------------------------------------------------
 * 设计目标：可解释、防刷、每天有上限。
 * - 首测经验只发一次：重测只更新称号与属性，不重复加分。
 * - 首测经验 = 起点等级门槛 + 正确率奖励（奖励不会跨级，避免"一次测满"）。
 * - 每日 3 个任务，每个任务每天只结算一次，按「日期 + 任务 id」记账。
 * - 当日 3 个任务全部完成有结算奖励；连续天数奖励有封顶。
 * - 单日可获得的经验值上限由公式算出，任何重复点击都会被账本拦下。
 */

export const ECONOMY = {
  /** 首测正确率奖励上限（实际还会被"不跨级"规则裁剪） */
  placementBonusMax: 60,
  /** 每日任务经验范围（由 daily.ts 中每个模板给出） */
  taskXpMin: 25,
  taskXpMax: 45,
  /** 当日 3 个任务全部完成 */
  dailyClearBonus: 30,
  /** 连续挑战奖励：min(streak, 10) * 3 */
  streakBonusPerDay: 3,
  streakBonusCap: 30,
  /** 单日经验上限：超过后当天不再累加（防刷兜底） */
  dailyXpCap: 300,
  /** 每日任务数量 */
  dailyTaskCount: 3,
  /** 首测抽题数量 */
  quizDrawCount: 14,
  /** 重测说明 */
  retakeNote: '重新测试只会更新称号与属性，不会重复发放经验值。',
} as const;

/** 连续天数对应的奖励（第 1 天 3 点，第 10 天起封顶 30） */
export function streakBonus(streak: number): number {
  const days = Math.max(0, Math.min(streak, 10));
  return Math.min(ECONOMY.streakBonusCap, days * ECONOMY.streakBonusPerDay);
}

/** 单日理论最大经验（3 个任务 + 全清奖励 + 满连续奖励），用于测试断言 */
export function theoreticalDailyMax(): number {
  return (
    ECONOMY.taskXpMax * ECONOMY.dailyTaskCount +
    ECONOMY.dailyClearBonus +
    streakBonus(10)
  );
}

/**
 * 首测经验：起点门槛 + 正确率奖励，且奖励最多把经验推到下一级门槛前 1 点。
 * 即使全错也至少给「参与奖励」10 点，保证首测一定有正反馈、不会出现 0 XP 的空结果。
 * @param baseXp 起点等级门槛
 * @param nextXp 下一等级门槛；已是最高级时传 baseXp
 * @param accuracy 0-1 的正确率
 */
export function placementXp(baseXp: number, nextXp: number, accuracy: number): number {
  const ratio = Math.max(0, Math.min(1, accuracy));
  const rawBonus = Math.max(10, Math.round(ratio * ECONOMY.placementBonusMax));
  const room = nextXp > baseXp ? nextXp - baseXp - 1 : 0;
  return baseXp + Math.max(0, Math.min(room, rawBonus));
}
