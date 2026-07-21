// XP・レベル・ストリーク・実績バッジ判定（DOM非依存）

// レベル1〜11だった頃のXP設計をそのまま引き継ぎ、以降も同系統の伸び方で
// レベル55まで拡張（称号がRANK_TITLE_LEVEL_STEPごとに切り替わるようにするため）
const LEVEL_TABLE = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000,
  4850, 5750, 6700, 7700, 8750, 9850, 11000, 12200, 13450, 14750,
  16100, 17500, 18950, 20450, 22000, 23600, 25250, 26950, 28700, 30500,
  32350, 34250, 36200, 38200, 40250, 42350, 44500, 46700, 48950, 51250,
  53600, 56000, 58450, 60950, 63500, 66100, 68750, 71450, 74200, 77000,
  79850, 82750, 85700, 88700,
];

// 称号はこの数値ごとに切り替わる（例: RANK_TITLE_LEVEL_STEP=5なら Lv.1-5, 6-10, ...）
const RANK_TITLE_LEVEL_STEP = 5;

// クメール語学習×冒険テーマの称号。RANK_TITLE_LEVEL_STEP刻みでLEVEL_TABLEの範囲を覆う
const RANK_TITLES = [
  "単語コレクター",
  "単語ハンター見習い",
  "言葉の探検家",
  "会話のトレジャーハンター",
  "クメール語ナイト",
  "クメール語エキスパート",
  "単語の賢人",
  "クメール語博士",
  "クメール語マスター",
  "伝説の言語使い",
  "全知全能のクメール語使い",
];

function gamCalcLevel(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    if (xp >= LEVEL_TABLE[i]) level = i + 1;
  }
  return level;
}

function gamXpForNextLevel(level) {
  return LEVEL_TABLE[level] != null ? LEVEL_TABLE[level] : null; // nullなら最大レベル到達
}

function gamGetRankTitle(level) {
  const idx = Math.floor((level - 1) / RANK_TITLE_LEVEL_STEP);
  return RANK_TITLES[Math.min(idx, RANK_TITLES.length - 1)];
}

// 1問の正誤結果からXP増分を計算する
// ctx: { isCorrect, isNewWord, comboCount, isComeback }
function gamCalcXpDelta(ctx) {
  if (!ctx.isCorrect) return 0;
  let xp = 10;
  if (ctx.isNewWord) xp += 5;
  if (ctx.isComeback) xp += 15;
  if (ctx.comboCount > 0 && ctx.comboCount % 3 === 0) xp += 5;
  return xp;
}

// ストリーク・累計学習日数を更新する。呼び出しは「その日の学習セッションを1回完了した」タイミングで行う
function gamUpdateStreak(userState, today) {
  if (userState.lastStudyDate === today) {
    return userState.streakDays; // 同日2回目以降はそのまま
  }
  if (userState.lastStudyDate == null) {
    userState.streakDays = 1;
  } else {
    const diff = diffDaysISO(userState.lastStudyDate, today);
    userState.streakDays = diff === 1 ? userState.streakDays + 1 : 1;
  }
  userState.totalStudyDays = (userState.totalStudyDays || 0) + 1;
  userState.lastStudyDate = today;
  return userState.streakDays;
}

// その日に解いた問題数を加算する（日付が変わったら自動リセット）
function gamUpdateDailyProgress(userState, today, answeredCount) {
  if (!userState.dailyProgress || userState.dailyProgress.date !== today) {
    userState.dailyProgress = { date: today, count: 0 };
  }
  userState.dailyProgress.count += answeredCount;
  return userState.dailyProgress.count;
}

function gamCountAtLeastBox(progress, minBox) {
  return Object.values(progress).filter((r) => r.box >= minBox).length;
}

function gamCountMastered(progress) {
  return gamCountAtLeastBox(progress, SRS_MAX_BOX);
}

function gamCountCore70AtLeastBox(progress, words, minBox) {
  return words.filter((w) => w.isCore70 && progress[w.id] && progress[w.id].box >= minBox).length;
}

function gamCountCore70Total(words) {
  return words.filter((w) => w.isCore70).length;
}

const BADGE_DEFINITIONS = [
  { id: "streak_3", name: "3日連続", icon: "🔥", condition: (ctx) => ctx.userState.streakDays >= 3 },
  { id: "streak_7", name: "7日連続", icon: "🔥", condition: (ctx) => ctx.userState.streakDays >= 7 },
  { id: "streak_14", name: "14日連続", icon: "🔥", condition: (ctx) => ctx.userState.streakDays >= 14 },
  { id: "box3_10words", name: "定着し始め", icon: "🌱", condition: (ctx) => gamCountAtLeastBox(ctx.progress, 3) >= 10 },
  { id: "master_50words", name: "50単語マスター", icon: "⭐", condition: (ctx) => gamCountMastered(ctx.progress) >= 50 },
  { id: "master_100words", name: "100単語マスター", icon: "🌟", condition: (ctx) => gamCountMastered(ctx.progress) >= 100 },
  { id: "master_all_258", name: "全258単語マスター", icon: "👑", condition: (ctx) => gamCountMastered(ctx.progress) >= 258 },
  { id: "touched_all_258", name: "全258単語に挑戦", icon: "🗺️", condition: (ctx) => Object.keys(ctx.progress).length >= 258 },
  { id: "core70_10words", name: "70選を10単語マスター", icon: "📌", condition: (ctx) => gamCountCore70AtLeastBox(ctx.progress, ctx.words, SRS_MAX_BOX) >= 10 },
  { id: "core70_all", name: "70選を制覇", icon: "📌", condition: (ctx) => gamCountCore70AtLeastBox(ctx.progress, ctx.words, SRS_MAX_BOX) >= gamCountCore70Total(ctx.words) },
  { id: "combo_10", name: "10問連続正解", icon: "🎯", condition: (ctx) => (ctx.userState.longestCombo || 0) >= 10 },
  { id: "combo_20", name: "20問連続正解", icon: "🎯", condition: (ctx) => (ctx.userState.longestCombo || 0) >= 20 },
  { id: "total_100", name: "累計100問", icon: "📚", condition: (ctx) => (ctx.userState.totalAnsweredCount || 0) >= 100 },
  { id: "total_500", name: "累計500問", icon: "📚", condition: (ctx) => (ctx.userState.totalAnsweredCount || 0) >= 500 },
  { id: "total_1000", name: "累計1000問", icon: "📚", condition: (ctx) => (ctx.userState.totalAnsweredCount || 0) >= 1000 },
  { id: "time_1h", name: "累計1時間", icon: "⏱️", condition: (ctx) => (ctx.userState.totalStudyMinutes || 0) >= 60 },
  { id: "time_10h", name: "累計10時間", icon: "⏱️", condition: (ctx) => (ctx.userState.totalStudyMinutes || 0) >= 600 },
  { id: "time_50h", name: "累計50時間", icon: "⏱️", condition: (ctx) => (ctx.userState.totalStudyMinutes || 0) >= 3000 },
  { id: "time_100h", name: "累計100時間", icon: "⏱️", condition: (ctx) => (ctx.userState.totalStudyMinutes || 0) >= 6000 },
  {
    id: "all_complete",
    name: "全実績コンプリート",
    icon: "🏆",
    condition: (ctx) =>
      BADGE_DEFINITIONS.filter((b) => b.id !== "all_complete").every((b) => ctx.userState.badges.includes(b.id)),
  },
];

// ctx: { userState, progress, words, lastSessionPerfect }
// 戻り値: 新たに獲得したバッジ定義の配列（userState.badgesはこの関数内では更新しない）
function gamCheckNewBadges(ctx) {
  const earned = ctx.userState.badges || [];
  return BADGE_DEFINITIONS.filter(
    (b) => !earned.includes(b.id) && b.condition(ctx)
  );
}

// ---------- ゴールド・ガチャ・コレクション ----------

const GOLD_PER_CORRECT_ANSWER = 3;
const GACHA_SINGLE_COST = 30;
const GACHA_TEN_COST = 300;

function gamCalcGoldDelta(isCorrect) {
  return isCorrect ? GOLD_PER_CORRECT_ANSWER : 0;
}

// レアリティごとの排出重み（アイテム1つあたり）。9コモン×8 + 5レア×5 + 3エピック×1 = 100
const ITEM_RARITY_WEIGHT = { common: 8, rare: 5, epic: 1 };
const ITEM_RARITY_LABEL = { common: "コモン", rare: "レア", epic: "エピック" };

// クメール・カンボジア文化をテーマにしたガチャアイテム
const ITEM_DEFINITIONS = [
  { id: "mango", name: "マンゴー", icon: "🥭", rarity: "common", desc: "カンボジア産の甘い完熟マンゴー。" },
  { id: "cashew_nut", name: "カシューナッツ", icon: "🥜", rarity: "common", desc: "カンボジアの特産品、香ばしいカシューナッツ。" },
  { id: "palm_sugar", name: "パームシュガー", icon: "🍯", rarity: "common", desc: "サトウヤシから作られる素朴な甘さの砂糖。" },
  { id: "coconut_oil", name: "ココナッツオイル", icon: "🧴", rarity: "common", desc: "肌にも髪にも使えるナチュラルなオイル。" },
  { id: "soap", name: "石鹸", icon: "🧼", rarity: "common", desc: "ハーブが練り込まれたカンボジア土産の石鹸。" },
  { id: "tiger_balm", name: "タイガーバーム", icon: "🐅", rarity: "common", desc: "肩こりや虫刺されに。カンボジアでも定番の万能薬。" },
  { id: "coconut_juice", name: "ココナッツジュース", icon: "🥥", rarity: "common", desc: "道端で売っている定番の一杯。飲んだ後の実も食べられる。" },
  { id: "angkor_cookie", name: "アンコールクッキー", icon: "🍪", rarity: "common", desc: "サクサクのカンボジア土産クッキー。" },
  { id: "angkor_beer", name: "アンコールビール", icon: "🍺", rarity: "common", desc: "定番の地元ビール。" },
  { id: "kampot_pepper", name: "カンポットペッパー", icon: "🌶️", rarity: "rare", desc: "世界的にも評価の高いカンポット産の胡椒。" },
  { id: "moringa_tea", name: "モリンガ茶", icon: "🍵", rarity: "rare", desc: "栄養豊富なモリンガの葉を使ったハーブティー。" },
  { id: "dried_fruit", name: "ドライフルーツ", icon: "🍇", rarity: "rare", desc: "マンゴーやパイナップルなど南国フルーツのドライフルーツ。" },
  { id: "krama", name: "クロマー", icon: "🧣", rarity: "rare", desc: "格子縞模様の伝統的な布。首に巻いたり日よけにしたり。" },
  { id: "khmer_chocolate", name: "カンボジア産チョコレート", icon: "🍫", rarity: "rare", desc: "カンポット産カカオを使ったクラフトチョコレート。" },
  { id: "tuktuk_model", name: "トゥクトゥク", icon: "🛺", rarity: "epic", desc: "街を走る三輪タクシー。ミニチュア模型でどこへでも連れて行ってくれる。" },
  { id: "golden_naga", name: "ナーガ像", icon: "🐉", rarity: "epic", desc: "寺院の屋根を飾る聖なる蛇神ナーガの像。" },
  { id: "angkor_wat_model", name: "アンコールワットの模型", icon: "🛕", rarity: "epic", desc: "世界遺産アンコールワットを模した精巧な模型。" },
];

function gamItemDropRatePercent(item) {
  const totalWeight = ITEM_DEFINITIONS.reduce((sum, i) => sum + ITEM_RARITY_WEIGHT[i.rarity], 0);
  return (ITEM_RARITY_WEIGHT[item.rarity] / totalWeight) * 100;
}

function _gamWeightedPickItem(pool) {
  const totalWeight = pool.reduce((sum, i) => sum + ITEM_RARITY_WEIGHT[i.rarity], 0);
  let r = Math.random() * totalWeight;
  for (const item of pool) {
    r -= ITEM_RARITY_WEIGHT[item.rarity];
    if (r <= 0) return item;
  }
  return pool[pool.length - 1];
}

function gamGachaRollOne() {
  return _gamWeightedPickItem(ITEM_DEFINITIONS);
}

// レア以上のみのプールから1件引く（10連ガチャの確定枠用）
function gamGachaRollGuaranteedRareUp() {
  return _gamWeightedPickItem(ITEM_DEFINITIONS.filter((i) => i.rarity !== "common"));
}

function _gamAwardItem(userState, item) {
  userState.itemCounts = userState.itemCounts || {};
  userState.itemCounts[item.id] = (userState.itemCounts[item.id] || 0) + 1;
}

// 単発ガチャ。引けなかった場合はnullを返す
function gamGachaPullSingle(userState) {
  if ((userState.gold || 0) < GACHA_SINGLE_COST) return null;
  userState.gold -= GACHA_SINGLE_COST;
  const item = gamGachaRollOne();
  _gamAwardItem(userState, item);
  return item;
}

// 10連ガチャ（最後の1枠はレア以上を確定）。引けなかった場合はnullを返す
function gamGachaPullTen(userState) {
  if ((userState.gold || 0) < GACHA_TEN_COST) return null;
  userState.gold -= GACHA_TEN_COST;
  const results = [];
  for (let i = 0; i < 9; i++) {
    const item = gamGachaRollOne();
    _gamAwardItem(userState, item);
    results.push(item);
  }
  const guaranteed = gamGachaRollGuaranteedRareUp();
  _gamAwardItem(userState, guaranteed);
  results.push(guaranteed);
  return results;
}
