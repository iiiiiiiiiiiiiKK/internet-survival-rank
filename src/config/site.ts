/**
 * 站点文案与接口占位声明（唯一数据源）
 * 这里只描述「尚未实现」的后端能力，UI 会明确标注为未上线，
 * 不会假装接口可用。
 */

export const SITE = {
  name: '互联网生存段位',
  enName: 'INTERNET SURVIVAL RANK',
  version: '1.0.0',
  slogan: '在信息洪流里，活得久一点。',
  disclaimer:
    '本站是娱乐向的本地小游戏，段位与称号只反映你在游戏里的选择，不代表真实能力、智力或人格评估。',
  privacy:
    '所有进度只保存在当前浏览器的 localStorage 中，不上传服务器。我们不收集真实姓名、手机号、通讯录或位置。',
} as const;

/** 未来后端能力占位：首版没有任何请求，UI 只展示"未上线" */
export const ROADMAP = [
  {
    id: 'account',
    name: '账号同步',
    desc: '跨设备保存段位与徽章。',
    status: 'planned' as const,
  },
  {
    id: 'leaderboard',
    name: '公开排行榜',
    desc: '按段位与经验值展示，需服务端校验。',
    status: 'planned' as const,
  },
  {
    id: 'friends',
    name: '好友挑战',
    desc: '邀请好友对同一个每日任务作答。',
    status: 'planned' as const,
  },
];

/** 预留的接口形状：仅类型声明，没有实现，也不会被调用 */
export interface FutureSyncApi {
  /** 未实现 */
  uploadProgress(payload: unknown): Promise<never>;
  /** 未实现 */
  fetchLeaderboard(): Promise<never>;
  /** 未实现 */
  createFriendChallenge(): Promise<never>;
}
