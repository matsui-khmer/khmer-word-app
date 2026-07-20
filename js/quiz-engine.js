// 出題生成ロジック（DOM非依存）: 出題形式の選択、4択distractorの選定

const QUIZ_MATCHING_PAIR_COUNT = 3; // マッチングゲーム1ラウンドで同時に扱う単語数

// remainingCount: このセッションで残っている問題数（マッチングに十分な数があるか判定するため）
// hasAudio: その単語の発音音声が利用可能か（リスニング問題を候補に入れてよいか）
function quizDecideType(box, settings, remainingCount, hasAudio) {
  const enableJpToKm = !settings || settings.enableJpToKm !== false;
  const canMatching = (remainingCount || 1) >= QUIZ_MATCHING_PAIR_COUNT;

  const candidates = [];
  if (box <= 2) {
    candidates.push(["flashcard", 55]);
    candidates.push(["km2jp", 25]);
    candidates.push(["truefalse", 20]);
  } else if (box <= 4) {
    candidates.push(["km2jp", enableJpToKm ? 30 : 60]);
    if (enableJpToKm) candidates.push(["jp2km", 30]);
    candidates.push(["truefalse", 15]);
    if (canMatching) candidates.push(["matching", 15]);
    if (hasAudio) candidates.push(["listening", 10]);
  } else {
    candidates.push(["km2jp", enableJpToKm ? 40 : 70]);
    if (enableJpToKm) candidates.push(["jp2km", 30]);
    candidates.push(["truefalse", 10]);
    if (canMatching) candidates.push(["matching", 10]);
    if (hasAudio) candidates.push(["listening", 10]);
  }

  const total = candidates.reduce((sum, [, weight]) => sum + weight, 0);
  let r = Math.random() * total;
  for (const [type, weight] of candidates) {
    if (r < weight) return type;
    r -= weight;
  }
  return candidates[0][0];
}

// 正答と同じカテゴリを優先しつつdistractorを選ぶ。field: "meaning" | "khmer"
function quizBuildDistractors(correctWord, allWords, field, count) {
  const pool = allWords.filter(
    (w) => w.id !== correctWord.id && w[field] !== correctWord[field]
  );
  const sameCategory = pool.filter((w) => w.category === correctWord.category);
  const otherCategory = pool.filter((w) => w.category !== correctWord.category);

  const picked = [];
  const pickedValues = new Set();

  for (const w of shuffle(sameCategory)) {
    if (picked.length >= count) break;
    if (pickedValues.has(w[field])) continue;
    picked.push(w);
    pickedValues.add(w[field]);
  }
  for (const w of shuffle(otherCategory)) {
    if (picked.length >= count) break;
    if (pickedValues.has(w[field])) continue;
    picked.push(w);
    pickedValues.add(w[field]);
  }
  return picked;
}

function quizBuildTrueFalseItem(word, allWords) {
  const distractors = quizBuildDistractors(word, allWords, "meaning", 1);
  const canShowFalse = distractors.length > 0;
  const showCorrect = !canShowFalse || Math.random() < 0.5;
  const displayedMeaning = showCorrect ? word.meaning : distractors[0].meaning;
  return { type: "truefalse", word, displayedMeaning, isStatementTrue: showCorrect };
}

// クメール語表記を見せず、音声だけを聞いて正しい意味を選ぶリスニング問題
function quizBuildListeningItem(word, allWords) {
  const distractors = quizBuildDistractors(word, allWords, "meaning", 3);
  const choiceWords = shuffle([word].concat(distractors));
  const choices = choiceWords.map((w) => ({
    label: w.meaning,
    isCorrect: w.id === word.id,
  }));
  return { type: "listening", word, choices };
}

// 1問分のクイズアイテムを構築する（type未定・単語1つ分の形式のみ）
// { type, word, choices?: [{label, isCorrect}], displayedMeaning?, isStatementTrue? }
function quizBuildItem(word, allWords, type) {
  if (type === "flashcard") {
    return { type: "flashcard", word };
  }
  if (type === "truefalse") {
    return quizBuildTrueFalseItem(word, allWords);
  }
  if (type === "listening") {
    return quizBuildListeningItem(word, allWords);
  }

  const field = type === "km2jp" ? "meaning" : "khmer";
  const distractors = quizBuildDistractors(word, allWords, field, 3);
  const choiceWords = shuffle([word].concat(distractors));
  const choices = choiceWords.map((w) => ({
    label: w[field],
    isCorrect: w.id === word.id,
    wordId: w.id,
  }));

  return { type, word, choices };
}

// マッチングゲーム1ラウンド分のアイテムを構築する（words: Wordオブジェクトの配列）
function quizBuildMatchingItem(words) {
  return {
    type: "matching",
    words,
    khmerOrder: shuffle(words.map((w) => w.id)),
    meaningOrder: shuffle(words.map((w) => w.id)),
  };
}
