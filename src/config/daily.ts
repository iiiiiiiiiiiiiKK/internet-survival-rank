/**
 * 每日挑战配置（唯一数据源）
 * ------------------------------------------------------------------
 * 每天凌晨（设备本地时间）生成 3 个轻量任务，同一天内刷新页面
 * 不会重新抽题：题目由「日期 + 安装盐」作为随机种子确定。
 *
 * 任务分 4 种玩法，每天随机取 3 种不同类型，保证不重复：
 *   choice 行为选择 · judge 单题判断 · tap 点掉弹窗 · timer 离线呼吸
 *
 * 所有任务都是「本地自证」的轻互动，不采集任何真实身份信息。
 */

export type DailyTaskType = 'choice' | 'judge' | 'tap' | 'timer';

export interface ChoiceOption {
  text: string;
  /** 行为标签，用于成就与个人主页统计（例如 calm / fight / browse） */
  tag: string;
}

export interface JudgeItem {
  id: string;
  prompt: string;
  /** true = 这条消息值得转发；false = 不该转 */
  shouldShare: boolean;
  explain: string;
}

export interface DailyTemplate {
  id: string;
  type: DailyTaskType;
  title: string;
  /** 任务说明，一句话 */
  desc: string;
  /** 完成后的奖励经验（30-45） */
  xp: number;
  /** 像素图标字符 */
  glyph: string;
  /** choice 型选项 */
  options?: ChoiceOption[];
  /** judge 型从题库里抽一题 */
  /** tap 型需要点掉的弹窗数 */
  targets?: number;
  /** tap 型限时（毫秒） */
  timeLimitMs?: number;
  /** timer 型倒计时（秒） */
  seconds?: number;
}

export const DAILY_TEMPLATES: DailyTemplate[] = [
  {
    id: 'choice-hot-take',
    type: 'choice',
    title: '血压管理',
    desc: '刷到一条明显引战的帖子，你打算怎么处理？',
    xp: 40,
    glyph: '😤',
    options: [
      { text: '截图存档，等时间线齐了再说', tag: 'calm' },
      { text: '先回一句，气势不能输', tag: 'fight' },
      { text: '划走，去看点别的', tag: 'browse' },
    ],
  },
  {
    id: 'choice-group-chat',
    type: 'choice',
    title: '群聊生存',
    desc: '群里有人发了一条没头没尾的爆料截图。',
    xp: 35,
    glyph: '💬',
    options: [
      { text: '问一句「有原始出处吗」', tag: 'calm' },
      { text: '跟着一起吃瓜', tag: 'browse' },
      { text: '把截图转到另一个群', tag: 'spread' },
    ],
  },
  {
    id: 'choice-notification',
    type: 'choice',
    title: '红点抵抗',
    desc: '手机上有 37 个红点，你的第一反应是？',
    xp: 30,
    glyph: '🔴',
    options: [
      { text: '只清掉真正需要处理的那几个', tag: 'calm' },
      { text: '全部点开，一个不留', tag: 'browse' },
      { text: '关掉通知，眼不见为净', tag: 'offline' },
    ],
  },
  {
    id: 'choice-stranger-dm',
    type: 'choice',
    title: '陌生私信',
    desc: '一个从没聊过的账号私信你「在吗？有事请教」。',
    xp: 38,
    glyph: '✉️',
    options: [
      { text: '先看对方主页和共同好友', tag: 'calm' },
      { text: '直接问什么事', tag: 'browse' },
      { text: '不回，先放着', tag: 'offline' },
    ],
  },
  {
    id: 'choice-ai-answer',
    type: 'choice',
    title: 'AI 说的',
    desc: '有人用一段 AI 生成的回答来反驳你。',
    xp: 36,
    glyph: '🤖',
    options: [
      { text: '请对方给出可核查的来源', tag: 'calm' },
      { text: '用另一段 AI 回答回敬', tag: 'fight' },
      { text: '表示收到，不再继续', tag: 'offline' },
    ],
  },
  {
    id: 'choice-late-night',
    type: 'choice',
    title: '凌晨三点',
    desc: '凌晨三点，你还在刷一条已经刷过的信息流。',
    xp: 32,
    glyph: '🌙',
    options: [
      { text: '放下手机，明天再看', tag: 'offline' },
      { text: '再看十分钟就睡', tag: 'browse' },
      { text: '起来写一条深夜感悟', tag: 'fight' },
    ],
  },
  {
    id: 'judge-forward',
    type: 'judge',
    title: '转发判断',
    desc: '判断这条消息到底该不该转发。',
    xp: 45,
    glyph: '🔍',
  },
  {
    id: 'judge-phishing',
    type: 'judge',
    title: '钓鱼识别',
    desc: '看一眼就知道这条链接要不要点。',
    xp: 42,
    glyph: '🎣',
  },
  {
    id: 'judge-source',
    type: 'judge',
    title: '出处核对',
    desc: '没有出处的说法，值不值得信？',
    xp: 40,
    glyph: '🧾',
  },
  {
    id: 'tap-popups',
    type: 'tap',
    title: '弹窗清扫',
    desc: '在 12 秒内点掉 6 个弹窗，还自己一个清净首页。',
    xp: 40,
    glyph: '🧹',
    targets: 6,
    timeLimitMs: 12000,
  },
  {
    id: 'tap-ads',
    type: 'tap',
    title: '广告闪避',
    desc: '在 12 秒内关掉 8 个"最后一天"的广告。',
    xp: 45,
    glyph: '📵',
    targets: 8,
    timeLimitMs: 12000,
  },
  {
    id: 'tap-misinfo',
    type: 'tap',
    title: '谣言粉碎',
    desc: '在 15 秒内点掉 7 条可疑信息。',
    xp: 42,
    glyph: '🧨',
    targets: 7,
    timeLimitMs: 15000,
  },
  {
    id: 'timer-breath',
    type: 'timer',
    title: '离线呼吸',
    desc: '离开信息流 20 秒，只做一次缓慢的呼吸。',
    xp: 35,
    glyph: '🌿',
    seconds: 20,
  },
  {
    id: 'timer-stretch',
    type: 'timer',
    title: '抬头 20 秒',
    desc: '把视线从屏幕移到窗外，20 秒后回来。',
    xp: 30,
    glyph: '🪟',
    seconds: 20,
  },
  {
    id: 'timer-water',
    type: 'timer',
    title: '补水提醒',
    desc: '倒一杯水，用 20 秒慢慢喝完。',
    xp: 30,
    glyph: '💧',
    seconds: 20,
  },
];

/** 判断题库：每天抽一题 */
export const JUDGE_ITEMS: JudgeItem[] = [
  {
    id: 'j01',
    prompt: '「内部消息：明天起所有 App 都要收费，快转给家人！」——朋友转给你，你会转发吗？',
    shouldShare: false,
    explain: '没有机构、没有链接、没有时间，只有情绪。这类消息的结局通常是辟谣。',
  },
  {
    id: 'j02',
    prompt: '「我朋友的朋友在医院工作，说今晚有大新闻」——一张截图，没有出处。',
    shouldShare: false,
    explain: '「朋友的朋友」是互联网最经典的匿名信源。',
  },
  {
    id: 'j03',
    prompt: '一段 9 秒视频，没有上下文，配文「太可怕了」，播放量 300 万。',
    shouldShare: false,
    explain: '无上下文的短视频，最容易被剪成任何想让你相信的样子。',
  },
  {
    id: 'j04',
    prompt: '官方账号发布的通知，附了链接、文号和发布日期，内容与你所在城市有关。',
    shouldShare: true,
    explain: '有主体、有原文、有日期，这是可以转发的消息。',
  },
  {
    id: 'j05',
    prompt: '「扫码领 100 元红包，仅限今天，过期作废」——发在一个陌生群里。',
    shouldShare: false,
    explain: '限时 + 免费 + 陌生群，是钓鱼三件套。',
  },
  {
    id: 'j06',
    prompt: '一条公益寻人信息，附有警方联系方式与官方发布渠道。',
    shouldShare: true,
    explain: '可核查的联系方式与官方来源，转发是有意义的。',
  },
  {
    id: 'j07',
    prompt: '「某品牌塌房实锤」——配图是模糊的聊天记录和一张拼接的转账截图。',
    shouldShare: false,
    explain: '聊天记录与转账截图是最容易被伪造的两样东西。',
  },
  {
    id: 'j08',
    prompt: '气象台发布的台风红色预警，附有预计路径和应急电话。',
    shouldShare: true,
    explain: '预警信息有官方主体和可执行建议，值得扩散。',
  },
  {
    id: 'j09',
    prompt: '「这个食物和那个食物一起吃会中毒」——来源是十年前的论坛老帖。',
    shouldShare: false,
    explain: '老帖的结论常常早已被更新，且没有剂量与条件。',
  },
  {
    id: 'j10',
    prompt: '一位医生在实名认证账号上发布的健康科普，引用了论文链接。',
    shouldShare: true,
    explain: '实名主体 + 可点击的原始文献，可核查性较高。',
  },
  {
    id: 'j11',
    prompt: '「再不转就晚了！这条消息已经被删了三次」——没有任何截图与出处。',
    shouldShare: false,
    explain: '强调「被删」是为了制造紧迫感，通常是为了让你不核查。',
  },
  {
    id: 'j12',
    prompt: '你朋友本人发的旅行照片，附了定位和日期，没有敏感信息。',
    shouldShare: true,
    explain: '真实、可控、无敏感信息，数字生活正常分享即可。',
  },
];

/** 生成每日任务时需要用到的配置 */
export const DAILY_RULES = {
  /** 每日任务数 */
  count: 3,
  /** 每天任务类型尽量不重复 */
  distinctTypes: true,
} as const;

export const TASK_TYPE_LABEL: Record<DailyTaskType, string> = {
  choice: '行为选择',
  judge: '单题判断',
  tap: '手速反应',
  timer: '离线计时',
};
