/**
 * 首测题库（15 题，每次随机抽取 14 题）
 * ------------------------------------------------------------------
 * 每题 3 个选项，分属三个「互联网人格维度」：
 *   info  = 信息处理（考古、溯源、辨别）
 *   social= 社交能量（发言、群聊、扩列）
 *   vibe  = 赛博松弛（潜水、断网、心态）
 * 得分同时用于：初始段位（答对计分）+ 三维属性（选项归属计分）。
 * 正确答案是「更符合互联网生存常识」的选项，不是价值观判断。
 */

export type QuizAxis = 'info' | 'social' | 'vibe';

export interface QuizOption {
  text: string;
  axis: QuizAxis;
  /** 是否为更稳妥的互联网生存做法（决定首测分数） */
  correct: boolean;
  /** 简短的作答后解释 */
  note: string;
}

export interface QuizQuestion {
  id: string;
  /** 场景题干 */
  scenario: string;
  options: [QuizOption, QuizOption, QuizOption];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q01',
    scenario: '家族群里突然刷屏「转发这条消息能保平安」，你的第一反应是：',
    options: [
      { text: '先搜一下这句话的出处和辟谣记录', axis: 'info', correct: true, note: '溯源永远比转发快一步。' },
      { text: '发个表情包把话题岔开', axis: 'social', correct: false, note: '气氛是保住了，谣言还在。' },
      { text: '放下手机，去阳台站两分钟', axis: 'vibe', correct: false, note: '很健康，但群里依然在刷屏。' },
    ],
  },
  {
    id: 'q02',
    scenario: '一条热搜只有 4 个字，评论区已经吵到第 900 楼。你会：',
    options: [
      { text: '等时间线和多方信源出来再判断', axis: 'info', correct: true, note: '让子弹飞一会儿是互联网基本礼仪。' },
      { text: '加入战场，先站队再补课', axis: 'social', correct: false, note: '站队很快，打脸也很快。' },
      { text: '关掉热搜，去看猫片', axis: 'vibe', correct: false, note: '情绪稳定，信息为零。' },
    ],
  },
  {
    id: 'q03',
    scenario: '朋友发来一个「扫码领 100 元红包」的链接，你：',
    options: [
      { text: '看域名、看主体，不确定就不扫', axis: 'info', correct: true, note: '域名是互联网世界最便宜的门牌号，也最会骗人。' },
      { text: '先扫了再说，反正不亏', axis: 'social', correct: false, note: '这句话是无数诈骗剧本的开场白。' },
      { text: '转给另一个朋友，让他先试', axis: 'vibe', correct: false, note: '这不是松弛，这是转移风险。' },
    ],
  },
  {
    id: 'q04',
    scenario: '你刷到一张「某地今晚有大事」的模糊截图，没有来源。你会：',
    options: [
      { text: '以图搜图，找最早发布者', axis: 'info', correct: true, note: '截图可以没有出处，但转发者要负责。' },
      { text: '先发到群里问问大家怎么看', axis: 'social', correct: false, note: '一次转发就是一次二次传播。' },
      { text: '当作都市传说收藏', axis: 'vibe', correct: false, note: '收藏夹里的都市传说已经够多了。' },
    ],
  },
  {
    id: 'q05',
    scenario: '深夜 2 点，你在评论区看到有人被围攻。你会：',
    options: [
      { text: '先看清前因后果，必要时举报而非对骂', axis: 'info', correct: true, note: '截图、举报、保留证据，比输出情绪有效。' },
      { text: '立刻加入，替弱势一方出头', axis: 'social', correct: false, note: '善意也需要信息量支撑。' },
      { text: '关屏睡觉，明天再说', axis: 'vibe', correct: false, note: '睡眠确实重要，但事情可能已经变了。' },
    ],
  },
  {
    id: 'q06',
    scenario: '一个陌生网友私信你，自称是老同学，想借 500 元。你会：',
    options: [
      { text: '通过其他渠道核实身份，绝不直接转账', axis: 'info', correct: true, note: '熟人诈骗的第一课：换个渠道确认。' },
      { text: '金额不大，先借了显得仗义', axis: 'social', correct: false, note: '仗义和上当有时只差一次转账。' },
      { text: '已读不回，当作没看见', axis: 'vibe', correct: false, note: '安全但信息量为零，下次还会遇到。' },
    ],
  },
  {
    id: 'q07',
    scenario: '你想发一条吐槽同事的动态，最稳妥的做法是：',
    options: [
      { text: '不发，或者只描述事不描述人', axis: 'info', correct: true, note: '互联网没有真正的"仅自己可见"。' },
      { text: '发出去，反正他不用这个平台', axis: 'social', correct: false, note: '互联网的巧合比你想象的多。' },
      { text: '发在小号，图个痛快', axis: 'vibe', correct: false, note: '小号也是号，截图会走路。' },
    ],
  },
  {
    id: 'q08',
    scenario: '看到「免费领一年会员，只需填写身份证号」，你：',
    options: [
      { text: '直接关掉，并顺手举报', axis: 'info', correct: true, note: '免费的会员，通常用你的身份信息买单。' },
      { text: '填个假的试试看', axis: 'social', correct: false, note: '假信息也挡不住真钓鱼。' },
      { text: '收藏起来，说不定以后用得上', axis: 'vibe', correct: false, note: '收藏夹不是保险箱。' },
    ],
  },
  {
    id: 'q09',
    scenario: '群里开始传「某明星塌房」的聊天记录截图。你会：',
    options: [
      { text: '等当事人或权威媒体回应，先不站队', axis: 'info', correct: true, note: '聊天记录是最容易伪造的证据之一。' },
      { text: '第一时间转发到其他群', axis: 'social', correct: false, note: '你成了传播链的一环。' },
      { text: '吃瓜但不说话', axis: 'vibe', correct: false, note: '围观也是一种注意力投票。' },
    ],
  },
  {
    id: 'q10',
    scenario: '你的账号突然收到「异地登录」提醒，你：',
    options: [
      { text: '立刻改密码、开两步验证、检查登录设备', axis: 'info', correct: true, note: '这三步比任何"客服"电话都可靠。' },
      { text: '先问问朋友是不是他们登的', axis: 'social', correct: false, note: '朋友不会替你改密码。' },
      { text: '换个新头像压压惊', axis: 'vibe', correct: false, note: '头像救不了账号。' },
    ],
  },
  {
    id: 'q11',
    scenario: '你在网上看到有人求助：「急用钱，转发一次捐一元」。你：',
    options: [
      { text: '先核实机构与项目备案，再决定是否参与', axis: 'info', correct: true, note: '善意需要一条可查证的路径。' },
      { text: '立刻转发，救人要紧', axis: 'social', correct: false, note: '转发不一定救人，但一定会传播。' },
      { text: '不转，默默关掉', axis: 'vibe', correct: false, note: '不传播是底线，但可以做得更好。' },
    ],
  },
  {
    id: 'q12',
    scenario: '有人在你帖子里用非常专业的口吻反驳你，你：',
    options: [
      { text: '先确认对方论据是否可查，再决定要不要回应', axis: 'info', correct: true, note: '专业口吻不等于专业。' },
      { text: '立刻引用十段资料回击', axis: 'social', correct: false, note: '资料越多，越容易夹带情绪。' },
      { text: '删帖，眼不见为净', axis: 'vibe', correct: false, note: '删帖可以，但别删掉判断力。' },
    ],
  },
  {
    id: 'q13',
    scenario: '你准备在社交平台发布一张旅游照，照片里有酒店房卡。你会：',
    options: [
      { text: '先检查背景，去掉房卡、门牌、二维码等信息', axis: 'info', correct: true, note: '照片是会说话的，包括你不想说的部分。' },
      { text: '打码太麻烦，直接发', axis: 'social', correct: false, note: '麻烦三分钟，可能省掉一堆麻烦。' },
      { text: '只发定位，不发照片', axis: 'vibe', correct: false, note: '定位有时比照片更暴露。' },
    ],
  },
  {
    id: 'q14',
    scenario: '你连续刷了两小时短视频，感到又累又空虚。你会：',
    options: [
      { text: '设个时限，起身走走，再看要不要继续', axis: 'info', correct: true, note: '给注意力设一个可执行的边界。' },
      { text: '再刷一会儿，反正都这样了', axis: 'social', correct: false, note: '沉没成本最爱在深夜说话。' },
      { text: '直接卸载所有 App，明天再装回来', axis: 'vibe', correct: false, note: '极端断舍离，通常撑不过 24 小时。' },
    ],
  },
  {
    id: 'q15',
    scenario: '一个新平台要求用手机号注册，还要读取通讯录。你：',
    options: [
      { text: '拒绝通讯录权限，必要时换一个平台', axis: 'info', correct: true, note: '权限不是赠品，是你的社交地图。' },
      { text: '同意，反正大家都是这么用的', axis: 'social', correct: false, note: '大家都是这么用的，不代表这是对的。' },
      { text: '先同意，之后再改设置', axis: 'vibe', correct: false, note: '大多数人之后再也没改过。' },
    ],
  },
];

/** 首测抽题数量 */
export const QUIZ_DRAW_COUNT = 14;

/** 三个维度的展示信息 */
export const AXES: { id: QuizAxis; name: string; desc: string }[] = [
  { id: 'info', name: '信息雷达', desc: '溯源、核实、辨别' },
  { id: 'social', name: '社交电量', desc: '表达、互动、群聊' },
  { id: 'vibe', name: '赛博松弛', desc: '断网、心态、边界' },
];
