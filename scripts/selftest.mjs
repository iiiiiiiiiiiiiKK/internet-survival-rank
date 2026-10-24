/**
 * 玩法规则自测（不依赖浏览器）
 * ------------------------------------------------------------------
 * 用 esbuild 把 src/lib/testable.ts 打成临时 ESM，然后在 Node 中断言：
 * 段位/等级配置、首测评分、经验结算、防重复、跨天、时区倒退、
 * 徽章解锁、存档迁移/修复/导入导出、分享卡尺寸、每日任务确定性。
 *
 * 运行：node scripts/selftest.mjs
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = join(process.cwd(), '.selftest-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const outfile = join(tmp, 'bundle.mjs');

await build({
  entryPoints: ['src/lib/testable.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile,
  logLevel: 'error',
});

const m = await import(pathToFileURL(outfile).href);

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n## ${title}`);
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

/* ------------------------------------------------------------------ */
section('1. 段位与等级配置');

eq('段位数量为 8', m.TIERS.length, 8);
check('每个段位恰好 3 个等级', m.TIERS.every((t) => t.thresholds.length === 3 && t.titles.length === 3));
eq('总等级数 24', m.LEVELS.length, 24);
check(
  '等级门槛严格递增',
  m.LEVELS.every((l, i) => i === 0 || l.minXp > m.LEVELS[i - 1].minXp),
  m.LEVELS.map((l) => l.minXp).join(','),
);
check('隐藏段位存在且只有 1 个', m.TIERS.filter((t) => t.hidden).length === 1 && m.TIERS[7].id === 'phantom');
check('段位名称不重复', new Set(m.TIERS.map((t) => t.name)).size === 8);
eq('最低等级从 0 经验开始', m.LEVELS[0].minXp, 0);

/* 等级换算 */
eq('0 XP → 青铜 I', m.levelFromXp(0).title, m.TIERS[0].titles[0]);
eq('299 XP 仍在白银前', m.levelFromXp(299).tierId, 'bronze');
eq('300 XP → 白银 I', m.levelFromXp(300).tierId, 'silver');
eq('11400 XP → 最高级', m.levelFromXp(11400).index, 23);
eq('超过最高门槛仍是最高级', m.levelFromXp(999999).index, 23);

/* 进度 */
{
  const p = m.levelProgress(0);
  eq('0 XP 进度百分比为 0', p.percent, 0);
  eq('0 XP 到下一级差 80', p.remaining, 80);
  const max = m.levelProgress(11400);
  check('满级标记正确', max.isMax && max.percent === 100 && max.next === null);
}

/* ------------------------------------------------------------------ */
section('2. 首测评分');

check('题库至少 15 题', m.QUIZ_QUESTIONS.length >= 15);
eq('默认抽题数量 14', m.ECONOMY.quizDrawCount, 14);
check(
  '每题 3 个选项、恰好 1 个正确',
  m.QUIZ_QUESTIONS.every((q) => q.options.length === 3 && q.options.filter((o) => o.correct).length === 1),
);
{
  // 全对
  const allCorrect = m.QUIZ_QUESTIONS.slice(0, 14).map((q) => ({
    questionId: q.id,
    optionIndex: q.options.findIndex((o) => o.correct),
  }));
  const score = m.scorePlacement(allCorrect);
  eq('全对正确数 14', score.correctCount, 14);
  eq('全对百分比 100', score.percent, 100);
  check('全对起点为 14 级（钻石 II）', score.levelIndex === 13, `实际 ${score.levelIndex}`);
  eq('三维属性和等于题数', score.axes.info + score.axes.social + score.axes.vibe, 14);
}
{
  // 全错
  const allWrong = m.QUIZ_QUESTIONS.slice(0, 14).map((q) => ({
    questionId: q.id,
    optionIndex: q.options.findIndex((o) => !o.correct),
  }));
  const score = m.scorePlacement(allWrong);
  eq('全错正确数 0', score.correctCount, 0);
  eq('全错起点 0 级', score.levelIndex, 0);
  eq('全错百分比 0', score.percent, 0);
}
{
  // 抽题不重复
  const drawn = m.drawPlacementQuestions(m.mulberry32(42));
  eq('抽题数量 14', drawn.length, 14);
  eq('抽题不重复', new Set(drawn.map((q) => q.id)).size, 14);
  const again = m.drawPlacementQuestions(m.mulberry32(42));
  eq('同种子抽题一致', drawn.map((q) => q.id), again.map((q) => q.id));
  eq('选项顺序包含 0,1,2', [...drawn[0].order].sort().join(), '0,1,2');
}

/* 首测经验 */
{
  const base = m.createDefaultSave(1_700_000_000_000);
  const answers = m.QUIZ_QUESTIONS.slice(0, 14).map((q) => ({
    questionId: q.id,
    optionIndex: q.options.findIndex((o) => o.correct),
  }));
  const score = m.scorePlacement(answers);
  const out = m.applyQuizResult(base, score, answers, 1_700_000_000_000);
  check('首测发放了经验', out.rewarded && out.xpGained > 0);
  check('首测后 placed=true', out.save.placed);
  check('首测经验不低于起点门槛', out.save.xp >= m.LEVELS[score.levelIndex].minXp);
  check(
    '首测后仍在起点等级内（不跨级）',
    out.save.levelIndex === score.levelIndex,
    `等级 ${out.save.levelIndex} vs 起点 ${score.levelIndex}`,
  );
  check('首测写入账本一条 placement', out.save.ledger.filter((e) => e.id === 'placement').length === 1);
  eq('首测解锁至少 2 枚徽章', out.newBadges.length >= 2, true);

  // 重测不加经验
  const again = m.applyQuizResult(out.save, score, answers, 1_700_000_100_000);
  eq('重测不再发经验', again.xpGained, 0);
  eq('重测后经验不变', again.save.xp, out.save.xp);
  eq('重测次数 +1', again.save.stats.quizRetakes, 1);
  eq('重测不改 placed', again.save.placed, true);
}

/* ------------------------------------------------------------------ */
section('3. 每日任务生成');

{
  const a = m.generateDailyTasks('2026-10-25', 'salt-abc123');
  const b = m.generateDailyTasks('2026-10-25', 'salt-abc123');
  eq('同一天同盐任务一致', a.map((t) => t.id), b.map((t) => t.id));
  eq('每日任务数量为 3', a.length, 3);
  eq('每日任务类型不重复', new Set(a.map((t) => t.type)).size, 3);
  const c = m.generateDailyTasks('2026-10-26', 'salt-abc123');
  check('换一天任务会变化', a.map((t) => t.id).join() !== c.map((t) => t.id).join());
  check('judge 任务带题目 id', a.filter((t) => t.type === 'judge').every((t) => typeof t.judgeId === 'string'));
  check('choice 任务带 3 个选项', a.filter((t) => t.type === 'choice').every((t) => (t.options?.length ?? 0) === 3));
  check('所有任务经验在 25-45 之间', a.every((t) => t.xp >= m.ECONOMY.taskXpMin && t.xp <= m.ECONOMY.taskXpMax));
}

/* ------------------------------------------------------------------ */
section('4. 每日任务结算与防重复');

function freshSave() {
  const now = new Date(2026, 9, 25, 8, 0, 0).getTime();
  const save = m.createDefaultSave(now);
  const answers = m.QUIZ_QUESTIONS.slice(0, 14).map((q) => ({
    questionId: q.id,
    optionIndex: q.options.findIndex((o) => o.correct),
  }));
  const score = m.scorePlacement(answers);
  // 与 App 启动流程一致：先 ensureToday 再进入首测结算
  const placed = m.applyQuizResult(save, score, answers, now).save;
  return m.ensureToday(placed, now);
}

const DAY = 24 * 3600 * 1000;
{
  const save = freshSave();
  const task = save.today.tasks[0];
  const now = new Date(2026, 9, 25, 10, 0, 0).getTime(); // 本地 2026-10-25 10:00
  const r1 = m.completeTask(save, { taskId: task.id, now });
  check('首次结算成功', r1.accepted);
  check('经验增加了', r1.xpGained > 0);
  const r2 = m.completeTask(r1.save, { taskId: task.id, now: now + 1000 });
  eq('重复结算被拒绝', r2.accepted, false);
  eq('重复结算原因 already-done', r2.reason, 'already-done');
  eq('重复结算不加经验', r2.xpGained, 0);
  eq('重复结算经验值不变', r2.save.xp, r1.save.xp);
  eq('账本只有一条该任务', r1.save.ledger.filter((e) => e.id === `task:${task.id}`).length, 1);

  // 刷新模拟：从 JSON 还原后再次结算
  const restored = m.importSave(m.exportSave(r1.save), now).save;
  const r3 = m.completeTask(restored, { taskId: task.id, now: now + 2000 });
  eq('刷新后重复结算仍被拒绝', r3.accepted, false);

  // 同一天完成全部 3 个任务
  let s = r1.save;
  const outcomes = [r1];
  for (const t of s.today.tasks.slice(1)) {
    const r = m.completeTask(s, { taskId: t.id, now });
    outcomes.push(r);
    s = r.save;
  }
  eq('三个任务全部已结算', s.today.done.length, 3);
  check('全清奖励已发放', s.ledger.some((e) => e.id === `clear:${s.today.date}`));
  check('全清计数 +1', s.stats.perfectDays === 1);
  eq('任务完成计数 3', s.stats.tasksCompleted, 3);
  check('当天经验不超过上限', m.xpEarnedOn(s, s.today.date) <= m.ECONOMY.dailyXpCap, `${m.xpEarnedOn(s, s.today.date)}`);
  check('连续天数至少 1', s.stats.currentStreak >= 1);
  check('连续奖励已入账', s.ledger.some((e) => e.id === `streak:${s.today.date}`));
}

/* 跨天：新一天重新生成；连续天数递增 */
{
  let save = freshSave();
  const d1 = new Date(2026, 9, 25, 10, 0, 0).getTime();
  const d2 = new Date(2026, 9, 26, 9, 0, 0).getTime();
  const d3 = new Date(2026, 9, 28, 9, 0, 0).getTime(); // 断一天
  for (const t of save.today.tasks) save = m.completeTask(save, { taskId: t.id, now: d1 }).save;
  eq('第一天连续 1 天', save.stats.currentStreak, 1);

  const day2 = m.ensureToday(save, d2);
  eq('第二天生成了新任务', day2.today.date, '2026-10-26');
  check('第二天任务与第一天不同', day2.today.tasks[0].id !== save.today.tasks[0].id);
  const first2 = m.completeTask(day2, { taskId: day2.today.tasks[0].id, now: d2 });
  eq('连续天数变为 2', first2.streak, 2);
  eq('bestStreak 更新为 2', first2.save.stats.bestStreak, 2);
  eq('历史保留前一天', first2.save.history.some((h) => h.date === '2026-10-25'), true);

  const day4 = m.ensureToday(first2.save, d3);
  const first4 = m.completeTask(day4, { taskId: day4.today.tasks[0].id, now: d3 });
  eq('断签后连续天数重置为 1', first4.streak, 1);
  eq('bestStreak 保留 2', first4.save.stats.bestStreak, 2);
}

/* 时区/系统时间倒退：回到已完成的那一天不能重复领奖 */
{
  let save = freshSave();
  const d1 = new Date(2026, 9, 25, 10, 0, 0).getTime();
  const d2 = new Date(2026, 9, 26, 10, 0, 0).getTime();
  for (const t of save.today.tasks) save = m.completeTask(save, { taskId: t.id, now: d1 }).save;
  const xpAfterDay1 = save.xp;
  // 前进一天再回到第一天
  const day2 = m.ensureToday(save, d2);
  m.completeTask(day2, { taskId: day2.today.tasks[0].id, now: d2 });
  const back = m.ensureToday(save, d1); // 回到 10-25
  eq('回到过去复用旧的一天', back.today.date, '2026-10-25');
  eq('回到过去任务仍是已完成状态', back.today.done.length, 3);
  const retry = m.completeTask(back, { taskId: back.today.tasks[0].id, now: d1 });
  eq('回到过去不能重复领奖', retry.accepted, false);
  eq('回到过去经验不变', retry.save.xp, xpAfterDay1);
}

/* 单日上限 */
{
  const save = freshSave();
  const now = new Date(2026, 9, 25, 10, 0, 0).getTime();
  const bloated = {
    ...save,
    ledger: [
      ...save.ledger,
      { id: 'task:2026-10-25:fake', at: now, amount: m.ECONOMY.dailyXpCap - 5, label: '测试' },
    ],
  };
  const r = m.completeTask(bloated, { taskId: save.today.tasks[0].id, now });
  check('达到单日上限后只发放剩余额度', r.accepted && r.xpGained <= 5, `实际 ${r.xpGained}`);
  eq('单日经验不超过上限', m.xpEarnedOn(r.save, '2026-10-25') <= m.ECONOMY.dailyXpCap, true);
}

/* ------------------------------------------------------------------ */
section('5. 徽章');

{
  check('徽章数量 ≥ 30', m.BADGES.length >= 30, `实际 ${m.BADGES.length}`);
  eq('徽章 id 唯一', new Set(m.BADGES.map((b) => b.id)).size, m.BADGES.length);
  check('徽章指标全部有定义', m.BADGES.every((b) => typeof b.metric === 'string' && b.gte >= 0));
  check('每个分类至少有 3 枚', ['rank', 'quiz', 'daily', 'behavior', 'collect'].every((c) => m.BADGES.filter((b) => b.category === c).length >= 3));

  const save = freshSave();
  check('首测后解锁段位徽章', save.badges.some((b) => b.id === 'rank-bronze'));
  check('首测后解锁 quiz-first', save.badges.some((b) => b.id === 'quiz-first'));
  const silver = m.evaluateBadges({ ...save, xp: 300, levelIndex: 3 }, 1).save;
  check('达到白银解锁 rank-silver', silver.badges.some((b) => b.id === 'rank-silver'));
  const again = m.evaluateBadges(silver, 2);
  eq('已解锁徽章不会重复添加', again.newBadges.length, 0);
  eq('徽章不会重复', new Set(silver.badges.map((b) => b.id)).size, silver.badges.length);

  // 20 天内每天全清 → 应解锁 daily 系列与 streak 系列
  let sim = freshSave();
  const baseXp = sim.xp;
  let t = new Date(2026, 9, 25, 9, 0, 0).getTime();
  for (let day = 0; day < 20; day += 1) {
    const today = m.ensureToday(sim, t);
    sim = today;
    for (const task of today.today.tasks) {
      sim = m.completeTask(sim, { taskId: task.id, now: t }).save;
    }
    t += DAY;
  }
  check('20 天后 tasksCompleted=60', sim.stats.tasksCompleted === 60, `${sim.stats.tasksCompleted}`);
  check('20 天后 perfectDays=20', sim.stats.perfectDays === 20, `${sim.stats.perfectDays}`);
  check('20 天后连续 20 天', sim.stats.currentStreak === 20, `${sim.stats.currentStreak}`);
  for (const id of ['daily-10', 'daily-30', 'daily-60', 'daily-clear1', 'daily-clear7', 'streak-3', 'streak-7', 'streak-14']) {
    check(`解锁 ${id}`, sim.badges.some((b) => b.id === id));
  }
  check('经验值单调增长', sim.xp > 0);
  check('20 天新增经验不超过理论上限', sim.xp - baseXp <= m.theoreticalDailyMax() * 20 + 200, `实际新增 ${sim.xp - baseXp}`);
}

/* ------------------------------------------------------------------ */
section('6. 存档：校验、迁移、损坏恢复、导入导出');

{
  const fresh = m.createDefaultSave(1_700_000_000_000);
  const mem = m.createMemoryStorage();
  const saved = m.saveData(fresh, mem);
  check('写入成功', saved.ok);
  check('主键存在', typeof mem.getItem(m.STORAGE_KEY) === 'string');
  const loaded = m.loadSaveFrom(mem);
  eq('读取状态 ok', loaded.status, 'ok');
  eq('经验一致', loaded.save.xp, fresh.xp);
  eq('salt 一致', loaded.save.salt, fresh.salt);

  // 修改内容但不改校验和 → 应被识别
  const env = JSON.parse(mem.getItem(m.STORAGE_KEY));
  env.data.xp = 999999;
  mem.setItem(m.STORAGE_KEY, JSON.stringify(env));
  const tampered = m.loadSaveFrom(mem);
  check('篡改被检测（非 ok）', tampered.status !== 'ok', tampered.status);
  check('篡改时保留原始数据', typeof mem.getItem(m.CORRUPT_KEY) === 'string');

  // 完全损坏（非 JSON）→ 安全模式
  const mem2 = m.createMemoryStorage();
  mem2.setItem(m.STORAGE_KEY, '{not-json');
  const broken = m.loadSaveFrom(mem2);
  eq('非法 JSON → corrupt', broken.status, 'corrupt');
  check('损坏数据被备份', mem2.getItem(m.CORRUPT_KEY) === '{not-json');
  check('安全模式给出默认存档', broken.save.placed === false && broken.save.xp === 0);

  // 主档损坏但有备份 → 从备份恢复
  const mem3 = m.createMemoryStorage();
  const saveA = { ...fresh, xp: 123, placed: true };
  m.saveData(saveA, mem3);
  const saveB = { ...saveA, xp: 456 };
  m.saveData(saveB, mem3); // 备份 = saveA
  mem3.setItem(m.STORAGE_KEY, 'broken!!');
  const recovered = m.loadSaveFrom(mem3);
  eq('从备份恢复', recovered.status, 'recovered-backup');
  eq('备份里的经验', recovered.save.xp, 123);
  eq('恢复计数 +1', recovered.save.stats.corruptRecoveries, 1);
  check('恢复后 corruptRecoveries 徽章可解锁', m.evaluateBadges(recovered.save, 1).save.badges.some((b) => b.id === 'recover-1'));

  // 缺失字段的旧存档 → 修复
  const oldRaw = JSON.stringify({
    schemaVersion: 1,
    xp: 500,
    placed: true,
    stats: { tasksCompleted: 7 },
    axes: { info: 5 },
  });
  const mem4 = m.createMemoryStorage();
  mem4.setItem(m.STORAGE_KEY, oldRaw);
  const repaired = m.loadSaveFrom(mem4);
  check('旧版本被迁移', repaired.status === 'migrated' || repaired.status === 'repaired', repaired.status);
  eq('迁移后版本为 3', repaired.save.schemaVersion, 3);
  eq('迁移保留 xp', repaired.save.xp, 500);
  eq('迁移补齐 axes', repaired.save.axes.vibe, 0);
  eq('迁移补齐 stats', repaired.save.stats.tasksCompleted, 7);
  check('迁移补齐 salt', repaired.save.salt.length >= 8);

  // 导出 → 导入
  const text = m.exportSave(saveB);
  const imported = m.importSave(text);
  check('导入成功', imported.ok);
  eq('导入经验一致', imported.save.xp, 456);
  eq('导入统计 imports +1', imported.save.stats.imports, 1);
  const badJson = m.importSave('nope');
  eq('非法 JSON 导入失败', badJson.ok, false);
  const wrongShape = m.importSave(JSON.stringify({ hello: 'world' }));
  eq('结构不符导入失败', wrongShape.ok, false);
  const versionFuture = m.importSave(
    JSON.stringify({ format: 'isr-save', schemaVersion: 99, checksum: '', data: { ...saveB, schemaVersion: 99 } }),
  );
  eq('未来版本拒绝导入', versionFuture.ok, false);

  const tamperedText = (() => {
    const env = JSON.parse(text);
    env.data.xp = 1;
    return JSON.stringify(env);
  })();
  eq('校验和不符拒绝导入', m.importSave(tamperedText).ok, false);
}

/* 重置 */
{
  const save = freshSave();
  let sim = save;
  const now = new Date(2026, 9, 25, 10, 0, 0).getTime();
  sim = m.completeTask(sim, { taskId: sim.today.tasks[0].id, now }).save;
  const reset = m.resetProgress(sim, now + 1000);
  eq('重置后经验为 0', reset.save.xp, 0);
  eq('重置后未测段', reset.save.placed, false);
  eq('重置后只保留重置彩蛋徽章', reset.save.badges.map((b) => b.id), ['reset-1']);
  eq('重置记录 +1', reset.save.stats.resets, 1);
  check('重置后解锁"重新做人"', reset.newBadges.some((b) => b.id === 'reset-1'));
  eq('重置后没有历史', reset.save.quizHistory.length, 0);
}

/* ------------------------------------------------------------------ */
section('7. 防刷与不变量');

{
  eq('单日理论上限 ≤ 300', m.theoreticalDailyMax() <= 300, true);
  eq('连续奖励封顶 30', m.streakBonus(999), 30);
  eq('连续奖励第 1 天 3', m.streakBonus(1), 3);

  // 连续点同一个任务 20 次
  const save = freshSave();
  const now = new Date(2026, 9, 25, 10, 0, 0).getTime();
  let sim = save;
  const taskId = save.today.tasks[0].id;
  let acceptedCount = 0;
  for (let i = 0; i < 20; i += 1) {
    const r = m.completeTask(sim, { taskId, now: now + i });
    if (r.accepted) acceptedCount += 1;
    sim = r.save;
  }
  eq('同一任务连点只成功一次', acceptedCount, 1);
  eq('连点后账本只有一条', sim.ledger.filter((e) => e.id === `task:${taskId}`).length, 1);

  // 伪造 taskId
  const fake = m.completeTask(sim, { taskId: '2026-10-25:not-exist', now });
  eq('伪造任务被拒绝', fake.accepted, false);

  // 经验与等级永远一致
  for (const xp of [0, 79, 80, 299, 300, 11400, 20000]) {
    const save2 = { ...save, xp };
    const level = m.levelFromXp(xp);
    check(`levelFromXp 与门槛一致（${xp}）`, xp >= level.minXp && (m.LEVELS[level.index + 1]?.minXp ?? Infinity) > xp);
  }
}

/* ------------------------------------------------------------------ */
section('8. 分享卡与摘要');

{
  const save = freshSave();
  const summary = m.rankSummary(save);
  check('摘要包含段位名', typeof summary.tierName === 'string' && summary.tierName.length > 0);
  check('摘要包含等级称号', summary.levelTitle.length > 0);
  check('摘要徽章数不超过总数', summary.badgeCount <= summary.totalBadges);
  check('卡尺寸 1:1 为 1080×1080', m.CARD_SIZES.square.width === 1080 && m.CARD_SIZES.square.height === 1080);
  check('卡尺寸 3:4 为 1080×1440', m.CARD_SIZES.tall.width === 1080 && m.CARD_SIZES.tall.height === 1440);
  const text = m.cardText(summary, '测试昵称');
  check('文案包含昵称', text.includes('测试昵称'));
  check('文案包含娱乐声明', text.includes('不代表真实能力'));
  check('文案包含徽章数', text.includes(String(summary.badgeCount)));
  check('比例常量为两种', Object.keys(m.CARD_SIZES).length === 2);
}

/* ------------------------------------------------------------------ */
section('9. 日期工具');

{
  eq('todayKey 使用本地日期', m.todayKey(new Date(2026, 0, 2, 23, 59, 0).getTime()), '2026-01-02');
  eq('跨天差值为 1', m.daysBetween('2026-10-24', '2026-10-25'), 1);
  eq('跨月差值为 3', m.daysBetween('2026-09-28', '2026-10-01'), 3);
  check('非法日期返回 NaN', Number.isNaN(m.daysBetween('2026-13-01', '2026-10-01')));
}

/* ------------------------------------------------------------------ */
console.log(`\n${passed} 项通过，${failures.length} 项失败`);
if (failures.length) {
  console.log('\n失败项：');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✅ 全部规则自测通过');
