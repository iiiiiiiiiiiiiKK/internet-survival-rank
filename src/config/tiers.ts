/**
 * 段位与等级配置（唯一数据源）
 * ------------------------------------------------------------------
 * 8 个段位 × 每个 3 个等级 = 24 级。经验值门槛只在这里定义一次，
 * 引擎、个人页、分享卡、测试用例全部从这里读取，改数值不会出现
 * 前后端/组件间不一致。
 *
 * 注意：互联网生存段位是娱乐玩法，不是真实能力评估。
 */

export type TierId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'master'
  | 'grandmaster'
  | 'phantom';

export interface LevelDef {
  /** 全局等级序号，0 起，共 24 级 */
  index: number;
  tierId: TierId;
  /** 段位内等级 1..3 */
  step: number;
  roman: 'I' | 'II' | 'III';
  /** 该等级升级所需的最低累计经验值 */
  minXp: number;
  /** 该等级的专属称号 */
  title: string;
}

export interface TierDef {
  id: TierId;
  name: string;
  /** 段位主称号，例如「初级冲浪者」 */
  epithet: string;
  /** 一句话人设，用于首页与分享卡 */
  tagline: string;
  /** 主色（升级反馈、徽章、进度条） */
  color: string;
  /** 深色变体，用于渐变与描边 */
  colorDark: string;
  /** 是否隐藏段位（未解锁时在段位表显示 ???） */
  hidden?: boolean;
  /** 三级的经验门槛 */
  thresholds: [number, number, number];
  /** 三级的专属称号 */
  titles: [string, string, string];
}

export const TIERS: TierDef[] = [
  {
    id: 'bronze',
    name: '青铜',
    epithet: '初级冲浪者',
    tagline: '刚学会用一条网线连接世界，看到加载圈会紧张。',
    color: '#d08a4a',
    colorDark: '#7a4a22',
    thresholds: [0, 80, 180],
    titles: ['初次上线', '摸鱼新手', '初级冲浪者'],
  },
  {
    id: 'silver',
    name: '白银',
    epithet: '深夜潜水员',
    tagline: '白天沉默，凌晨三点在评论区留下第一条"哈哈哈"。',
    color: '#c9d6e6',
    colorDark: '#6b7a8f',
    thresholds: [300, 440, 600],
    titles: ['深夜潜水员', '瓜田巡逻兵', '评论区常客'],
  },
  {
    id: 'gold',
    name: '黄金',
    epithet: '资深吃瓜群众',
    tagline: '热搜出来三分钟，你已经把时间线、聊天记录和旧帖全考古完了。',
    color: '#f5c542',
    colorDark: '#8a6a10',
    thresholds: [790, 1010, 1250],
    titles: ['资深吃瓜群众', '热梗速递员', '群聊气氛组'],
  },
  {
    id: 'platinum',
    name: '铂金',
    epithet: '信息搬运专家',
    tagline: '群友的快乐建立在你的复制粘贴之上，且你从不署名。',
    color: '#63e6c2',
    colorDark: '#1f6b58',
    thresholds: [1540, 1860, 2210],
    titles: ['信息搬运专家', '表情包管理员', '热搜导航仪'],
  },
  {
    id: 'diamond',
    name: '钻石',
    epithet: '键盘战略家',
    tagline: '能在 280 字里完成背景梳理、逻辑拆解和一句冷幽默收尾。',
    color: '#69a6ff',
    colorDark: '#23477f',
    thresholds: [2600, 3040, 3520],
    titles: ['键盘战略家', '长文折叠师', '赛博考古学家'],
  },
  {
    id: 'master',
    name: '大师',
    epithet: '互联网情报员',
    tagline: '你不需要搜索，你本身就是搜索，只是偶尔会缓存过期。',
    color: '#b678ff',
    colorDark: '#4d2a80',
    thresholds: [4060, 4660, 5320],
    titles: ['互联网情报员', '舆情雷达站', '流量解码器'],
  },
  {
    id: 'grandmaster',
    name: '宗师',
    epithet: '赛博老油条',
    tagline: '见过三次互联网的改朝换代，依然能心平气和地关掉推送。',
    color: '#ff6b9d',
    colorDark: '#7d2145',
    thresholds: [6060, 6880, 7780],
    titles: ['赛博老油条', '网络民俗学者', '数字生存大师'],
  },
  {
    id: 'phantom',
    name: '互联网幽灵',
    epithet: '离线传说',
    tagline: '你在线，但没人能证明；你不在线，世界照样转动。',
    color: '#8fffc4',
    colorDark: '#1f6a4a',
    hidden: true,
    thresholds: [8800, 10000, 11400],
    titles: ['互联网幽灵', '无名观测者', '离线传说'],
  },
];

/** 展平后的 24 个等级，index 即全局等级序号 */
export const LEVELS: LevelDef[] = TIERS.flatMap((tier) =>
  tier.thresholds.map((minXp, i) => ({
    index: 0, // 占位，下面统一重排
    tierId: tier.id,
    step: i + 1,
    roman: (['I', 'II', 'III'] as const)[i],
    minXp,
    title: tier.titles[i],
  })),
).map((level, index) => ({ ...level, index }));

export const MAX_LEVEL_INDEX = LEVELS.length - 1;

export function getTier(tierId: TierId): TierDef {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) throw new Error(`未知段位: ${tierId}`);
  return tier;
}

/** 某个段位在 TIERS 中的序号（0 起） */
export function getTierIndex(tierId: TierId): number {
  return TIERS.findIndex((t) => t.id === tierId);
}

/**
 * 测试得分（百分比，0-100）→ 初始等级序号。
 * 规则刻意做成可解释的档位表：14 题满分 42 分，答对越多起点越高，
 * 但首测最高只能到「钻石 II」，剩下的段位交给每日挑战继续爬。
 */
export const PLACEMENT_BANDS: { minPercent: number; levelIndex: number }[] = [
  { minPercent: 0, levelIndex: 0 },
  { minPercent: 14, levelIndex: 1 },
  { minPercent: 28, levelIndex: 2 },
  { minPercent: 40, levelIndex: 3 },
  { minPercent: 50, levelIndex: 4 },
  { minPercent: 60, levelIndex: 5 },
  { minPercent: 68, levelIndex: 6 },
  { minPercent: 76, levelIndex: 7 },
  { minPercent: 82, levelIndex: 8 },
  { minPercent: 88, levelIndex: 9 },
  { minPercent: 92, levelIndex: 10 },
  { minPercent: 95, levelIndex: 11 },
  { minPercent: 97, levelIndex: 12 },
  { minPercent: 99, levelIndex: 13 },
];

export function placementLevelIndex(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent));
  let result = 0;
  for (const band of PLACEMENT_BANDS) {
    if (clamped >= band.minPercent) result = band.levelIndex;
  }
  return Math.max(0, Math.min(MAX_LEVEL_INDEX, result));
}
