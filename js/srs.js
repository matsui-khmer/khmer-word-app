// SRS（間隔反復）ロジック: Leitner box方式（DOM非依存の純粋関数群）

const SRS_BOX_INTERVAL_DAYS = {
  1: 0,   // 当日〜翌日に再出題
  2: 2,
  3: 4,
  4: 7,
  5: 14,
  6: 30,  // マスター状態
};
const SRS_MAX_BOX = 6;
const SRS_SESSION_MAX_QUESTIONS = 20;
const SRS_SESSION_NEW_WORD_MAX = 6;

// 出題数（サイズ）ごとの新規単語の枠数。未定義サイズは sessionMax/3 にフォールバック
const SRS_NEW_WORD_RATIO_TABLE = { 5: 2, 10: 3, 15: 5, 20: 6, 30: 8, 50: 12 };
function srsResolveNewWordMax(sessionMax) {
  return SRS_NEW_WORD_RATIO_TABLE[sessionMax] != null
    ? SRS_NEW_WORD_RATIO_TABLE[sessionMax]
    : Math.max(2, Math.round(sessionMax / 3));
}

function srsCreateNewRecord(today) {
  return {
    box: 1,
    dueDate: today,
    lastReviewedAt: null,
    correctCount: 0,
    incorrectCount: 0,
    firstSeenAt: today,
  };
}

function srsApplyAnswer(record, isCorrect, todayISOStr, nowISOStr) {
  const next = Object.assign({}, record);
  next.lastReviewedAt = nowISOStr;
  if (isCorrect) {
    next.box = Math.min(next.box + 1, SRS_MAX_BOX);
    next.correctCount = (next.correctCount || 0) + 1;
  } else {
    next.box = 1;
    next.incorrectCount = (next.incorrectCount || 0) + 1;
  }
  next.dueDate = addDaysISO(todayISOStr, SRS_BOX_INTERVAL_DAYS[next.box]);
  return next;
}

// 今日復習すべき単語（progressが存在し、dueDate <= today）を延滞日数の多い順に抽出
// 同着（延滞日数が同じ）グループ内はシャッフルすることで、常に同じ単語ばかり
// 選ばれ続けることを防ぐ
function srsGetDueWordIds(progress, today) {
  const dueIds = Object.keys(progress).filter((wordId) => progress[wordId].dueDate <= today);
  const groups = new Map();
  dueIds.forEach((wordId) => {
    const overdue = diffDaysISO(progress[wordId].dueDate, today);
    if (!groups.has(overdue)) groups.set(overdue, []);
    groups.get(overdue).push(wordId);
  });
  return Array.from(groups.keys())
    .sort((a, b) => b - a)
    .flatMap((overdue) => shuffle(groups.get(overdue)));
}

// まだ一度も学習していない単語を抽出する（70選優先だが、優先グループ内はシャッフルする）
function srsGetUnseenWords(progress, allWords) {
  const unseen = allWords.filter((w) => !progress[w.id]);
  const core70 = shuffle(unseen.filter((w) => w.isCore70));
  const rest = shuffle(unseen.filter((w) => !w.isCore70));
  return core70.concat(rest);
}

// 単語の理解度を5段階で算出する（1=未出題/最低 〜 5=マスター/最高）
// Leitner boxを主軸に、box境界上のみ正答率で補正する
function srsComprehensionRank(record) {
  if (!record) return 1;
  const total = (record.correctCount || 0) + (record.incorrectCount || 0);
  const accuracy = total > 0 ? record.correctCount / total : 0;

  if (record.box >= 6) return 5;
  if (record.box >= 4) return 4;
  if (record.box === 3) return 3;
  if (record.box === 2) return accuracy >= 0.5 ? 3 : 2;
  return 2; // box1
}

const SRS_COMPREHENSION_RANK_META = [
  null,
  { rank: 1, label: "未出題", icon: "❔" },
  { rank: 2, label: "苦手", icon: "⚠️" },
  { rank: 3, label: "学習中", icon: "🌱" },
  { rank: 4, label: "定着", icon: "🛡️" },
  { rank: 5, label: "マスター", icon: "⭐" },
];

// 理解度が低く、延滞が長い単語ほど大きくなる重み（延滞日数は14日で頭打ち）
function srsDueWordWeight(record, overdueDays) {
  const rank = srsComprehensionRank(record);
  const rankWeight = 6 - rank;
  const overdueWeight = 1 + Math.min(Math.max(overdueDays, 0), 14);
  return rankWeight * overdueWeight;
}

// Efraimidis-Spirakis法による重み付き非復元抽出
function srsWeightedSample(items, weights, count) {
  const keyed = items.map((item, i) => ({
    item,
    key: Math.pow(Math.random(), 1 / Math.max(weights[i], 0.0001)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, count).map((k) => k.item);
}

// 復習対象の中からセッション容量に合わせて選抜する
// 容量内に収まるならそのまま全件、超える場合は理解度が低い単語を優先する重み付き抽選
function srsSelectDueWordIdsForSession(progress, scopeWordIds, today, count) {
  const dueIds = Object.keys(progress).filter(
    (wordId) => progress[wordId].dueDate <= today && scopeWordIds.has(wordId)
  );
  if (dueIds.length <= count) return shuffle(dueIds);

  const weights = dueIds.map((wordId) =>
    srsDueWordWeight(progress[wordId], diffDaysISO(progress[wordId].dueDate, today))
  );
  return srsWeightedSample(dueIds, weights, count);
}

// 1セッション分の出題単語IDリストを構築する
// 復習優先度順 + 新規単語を一定数補充 → シャッフルして返す
// options.scope: "all"（既定）または "core70"（超重要70選のみを出題対象にする）
// options.sessionMax: 1セッションの出題数（既定 SRS_SESSION_MAX_QUESTIONS）
function srsBuildSession(progress, allWords, today, options) {
  options = options || {};
  const sessionMax = options.sessionMax || SRS_SESSION_MAX_QUESTIONS;
  const newWordMax = options.newWordMax != null ? options.newWordMax : srsResolveNewWordMax(sessionMax);

  const scopeWords = options.scope === "core70" ? allWords.filter((w) => w.isCore70) : allWords;
  const scopeWordIds = new Set(scopeWords.map((w) => w.id));

  const dueIds = srsSelectDueWordIdsForSession(progress, scopeWordIds, today, sessionMax);

  const remainingSlots = Math.max(0, sessionMax - dueIds.length);
  // 復習対象が全く無い場合（学習初期など）は新規単語で枠を埋める。
  // 復習対象がある場合は、詰め込みすぎ防止のため新規単語は目安枠までに抑える
  const newWordSlots = dueIds.length > 0 ? Math.min(newWordMax, remainingSlots) : remainingSlots;
  const unseenWords = srsGetUnseenWords(progress, scopeWords).slice(0, newWordSlots);
  const newIds = unseenWords.map((w) => w.id);

  let queue = dueIds.concat(newIds);

  // 「今日の分」（復習+新規）だけではセッション枠が埋まらない場合、
  // 理解度が低い単語ほど選ばれやすい重み付き抽選で残り枠を埋め、学習が尽きないようにする
  if (queue.length < sessionMax) {
    const usedIds = new Set(queue);
    const fillCandidates = scopeWords.filter((w) => !usedIds.has(w.id));
    const fillCount = Math.min(sessionMax - queue.length, fillCandidates.length);
    if (fillCount > 0) {
      const weights = fillCandidates.map((w) => 6 - srsComprehensionRank(progress[w.id]));
      const filled = srsWeightedSample(fillCandidates, weights, fillCount);
      queue = queue.concat(filled.map((w) => w.id));
    }
  }

  return shuffle(queue);
}
