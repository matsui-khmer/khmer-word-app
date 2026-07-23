// 文法画面（一覧・解説カード・4択クイズ・並び替えクイズ・結果）

const GRAMMAR_QUIZ_PASS_RATIO = 0.6;
const GRAMMAR_XP_PER_CORRECT = 8;

let grammarCurrentTopicId = null;
let grammarQuizState = null; // { queue: [...], index, correctCount, xpEarned, goldEarned }
let grammarReorderState = null; // { queue: [...], index, correctCount, xpEarned, goldEarned, tokens, bankIndices, placedIndices }
let grammarResultRetryAction = null; // 結果画面の「もう一度挑戦する」が呼ぶ関数

function initGrammarScreen() {
  document.getElementById("grammar-topic-list").addEventListener("click", (e) => {
    const tile = e.target.closest(".grammar-topic-tile");
    if (!tile) return;
    openGrammarTopic(tile.dataset.topicId);
  });

  document.getElementById("grammar-challenge-btn").addEventListener("click", () => {
    startGrammarReorderChallenge();
  });

  document.getElementById("grammar-back-to-list-btn").addEventListener("click", () => {
    renderGrammarScreen();
  });

  document.getElementById("grammar-start-quiz-btn").addEventListener("click", () => {
    startGrammarQuiz(grammarCurrentTopicId);
  });

  document.getElementById("grammar-start-reorder-btn").addEventListener("click", () => {
    startGrammarReorder(grammarCurrentTopicId);
  });

  document.getElementById("grammar-reorder-reset-btn").addEventListener("click", () => {
    resetGrammarReorderPlacement();
  });

  document.getElementById("grammar-quiz-next-btn").addEventListener("click", () => {
    advanceGrammarQuiz();
  });

  document.getElementById("grammar-reorder-next-btn").addEventListener("click", () => {
    advanceGrammarReorder();
  });

  document.getElementById("grammar-result-retry-btn").addEventListener("click", () => {
    if (grammarResultRetryAction) grammarResultRetryAction();
  });

  document.getElementById("grammar-result-back-btn").addEventListener("click", () => {
    renderGrammarScreen();
  });
}

function showGrammarView(viewName) {
  ["list", "detail", "quiz", "reorder", "result"].forEach((name) => {
    document.getElementById("grammar-" + name + "-view").style.display = name === viewName ? "" : "none";
  });
}

function renderGrammarScreen() {
  showGrammarView("list");
  renderGrammarTopicList();
}

function renderGrammarTopicList() {
  const progress = App.user.grammarProgress || {};
  const html = GRAMMAR_TOPICS.slice()
    .sort((a, b) => a.order - b.order)
    .map((topic) => {
      const done = !!(progress[topic.id] && progress[topic.id].completed);
      return `
        <div class="card grammar-topic-tile ${done ? "completed" : ""}" data-topic-id="${topic.id}">
          <span class="grammar-topic-icon">${topic.icon}</span>
          <div>
            <div class="grammar-topic-order">${topic.order}</div>
            <div class="grammar-topic-title">${topic.title}</div>
          </div>
          <span class="grammar-topic-status">${done ? "✅ 学習済み" : "未学習"}</span>
        </div>
      `;
    })
    .join("");
  document.getElementById("grammar-topic-list").innerHTML = html;
}

function getGrammarTopic(topicId) {
  return GRAMMAR_TOPICS.find((t) => t.id === topicId);
}

function openGrammarTopic(topicId) {
  grammarCurrentTopicId = topicId;
  const topic = getGrammarTopic(topicId);

  document.getElementById("grammar-cards-container").innerHTML = topic.cards
    .map((card) => {
      const exampleHtml = card.example
        ? `
          <div class="grammar-example">
            <div class="grammar-khmer khmer">${card.example.khmer}</div>
            <div class="grammar-reading">${card.example.reading}</div>
            <div class="grammar-breakdown">${card.example.breakdown}</div>
            <div class="grammar-translation">${card.example.translation}</div>
          </div>
        `
        : "";
      return `
        <div class="card grammar-card dq-window">
          <div class="grammar-rule">${card.rule}</div>
          ${exampleHtml}
        </div>
      `;
    })
    .join("");

  showGrammarView("detail");
}

// ---------- 4択クイズ ----------

function startGrammarQuiz(topicId) {
  const topic = getGrammarTopic(topicId);
  const queue = shuffle(topic.quiz).map((q) => {
    const correctChoiceText = q.choices[q.correctIndex];
    const shuffledChoices = shuffle(q.choices);
    return {
      prompt: q.prompt,
      choices: shuffledChoices,
      correctIndex: shuffledChoices.indexOf(correctChoiceText),
    };
  });

  grammarQuizState = { queue, index: 0, correctCount: 0, xpEarned: 0, goldEarned: 0 };
  showGrammarView("quiz");
  renderGrammarQuizQuestion();
}

function renderGrammarQuizQuestion() {
  const s = grammarQuizState;
  document.getElementById("grammar-quiz-feedback-banner").innerHTML = "";
  document.getElementById("grammar-quiz-next-btn").style.display = "none";

  const total = s.queue.length;
  document.getElementById("grammar-quiz-progress-label").textContent = `${s.index + 1} / ${total}`;
  document.getElementById("grammar-quiz-progress-bar").style.width = `${(s.index / total) * 100}%`;

  const item = s.queue[s.index];
  document.getElementById("grammar-quiz-card").innerHTML = `<div class="prompt-khmer" style="font-size:18px;">${item.prompt}</div>`;

  document.getElementById("grammar-quiz-answer-area").innerHTML = `
    <div class="choice-grid">
      ${item.choices.map((c, i) => `<button class="choice-btn" data-index="${i}">${c}</button>`).join("")}
    </div>
  `;
  document.querySelectorAll("#grammar-quiz-answer-area .choice-btn").forEach((btn, i) => {
    btn.addEventListener("click", () => handleGrammarChoiceClick(i));
  });
}

function handleGrammarChoiceClick(index) {
  const s = grammarQuizState;
  const item = s.queue[s.index];
  const isCorrect = index === item.correctIndex;

  document.querySelectorAll("#grammar-quiz-answer-area .choice-btn").forEach((btn, i) => {
    btn.disabled = true;
    if (i === item.correctIndex) btn.classList.add("correct");
    else if (i === index && !isCorrect) btn.classList.add("incorrect");
  });

  setTimeout(() => handleGrammarAnswer(isCorrect), 700);
}

function handleGrammarAnswer(isCorrect) {
  const s = grammarQuizState;

  if (isCorrect) {
    s.correctCount++;
    s.xpEarned += GRAMMAR_XP_PER_CORRECT;
    s.goldEarned += GOLD_PER_CORRECT_ANSWER;
    App.user.xp += GRAMMAR_XP_PER_CORRECT;
    App.user.gold = (App.user.gold || 0) + GOLD_PER_CORRECT_ANSWER;
    App.user.level = gamCalcLevel(App.user.xp);
  }

  const banner = document.getElementById("grammar-quiz-feedback-banner");
  banner.innerHTML = `<div class="feedback-banner ${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "正解！" : "おしい！"}</div>`;

  if (isCorrect) soundPlayCorrect();
  else soundPlayIncorrect();

  if (isCorrect) {
    setTimeout(advanceGrammarQuiz, 900);
  } else {
    document.getElementById("grammar-quiz-next-btn").style.display = "";
  }
}

function advanceGrammarQuiz() {
  const s = grammarQuizState;
  document.getElementById("grammar-quiz-next-btn").style.display = "none";
  s.index++;
  if (s.index >= s.queue.length) {
    finishGrammarQuiz();
  } else {
    renderGrammarQuizQuestion();
  }
}

function finishGrammarQuiz() {
  const s = grammarQuizState;
  const total = s.queue.length;
  const passed = s.correctCount / total >= GRAMMAR_QUIZ_PASS_RATIO;

  const progress = App.user.grammarProgress || (App.user.grammarProgress = {});
  const prev = progress[grammarCurrentTopicId] || { completed: false, bestScore: 0, attempts: 0 };
  progress[grammarCurrentTopicId] = {
    completed: prev.completed || passed,
    bestScore: Math.max(prev.bestScore, s.correctCount),
    attempts: prev.attempts + 1,
  };
  saveUserState(App.user);

  soundPlaySessionComplete();

  const topic = getGrammarTopic(grammarCurrentTopicId);
  document.getElementById("grammar-result-hero").innerHTML = `
    <div class="sub">「${topic.title}」の4択クイズ結果</div>
    <div class="big-xp">${s.correctCount} / ${total} 問正解</div>
    <div class="big-gold">+${s.xpEarned} XP　+${s.goldEarned} 🪙</div>
    <div style="margin-top:8px; color:var(--dq-window-text); font-size:13px; opacity:0.85;">
      ${passed ? "このトピックを「学習済み」にしました！" : "もう一度挑戦してみましょう"}
    </div>
  `;

  grammarResultRetryAction = () => startGrammarQuiz(grammarCurrentTopicId);
  showGrammarView("result");
}

// ---------- 並び替えクイズ ----------

// 文末の「。」「？」は語順の答えとして自明なので、単語トークンから切り離して
// 常に末尾に固定表示する（並び替えの対象にしない）
function tokenizeGrammarReorderKhmer(khmerText) {
  const rawTokens = khmerText.split(/\s+/).filter(Boolean);
  const lastIndex = rawTokens.length - 1;
  const wordTokens = rawTokens.slice();
  let punctuation = "";

  const punctMatch = rawTokens[lastIndex].match(/([។？])$/);
  if (punctMatch) {
    punctuation = punctMatch[0];
    const stripped = wordTokens[lastIndex].slice(0, wordTokens[lastIndex].length - punctuation.length);
    if (stripped) {
      wordTokens[lastIndex] = stripped;
    } else {
      wordTokens.pop();
    }
  }

  return { wordTokens, punctuation };
}

function buildGrammarReorderItem(topic) {
  const { wordTokens, punctuation } = tokenizeGrammarReorderKhmer(topic.reorder.khmer);
  const readings = topic.reorder.reading.split(/[\s　]+/).filter(Boolean);
  return {
    topicTitle: topic.title,
    translation: topic.reorder.translation,
    tokens: wordTokens,
    readings,
    punctuation,
  };
}

function startGrammarReorder(topicId) {
  const topic = getGrammarTopic(topicId);
  grammarReorderState = {
    queue: [buildGrammarReorderItem(topic)],
    index: 0,
    correctCount: 0,
    xpEarned: 0,
    goldEarned: 0,
    isChallenge: false,
  };
  showGrammarView("reorder");
  renderGrammarReorderQuestion();
}

function startGrammarReorderChallenge() {
  const queue = shuffle(GRAMMAR_TOPICS).map((topic) => buildGrammarReorderItem(topic));
  grammarReorderState = {
    queue,
    index: 0,
    correctCount: 0,
    xpEarned: 0,
    goldEarned: 0,
    isChallenge: true,
  };
  showGrammarView("reorder");
  renderGrammarReorderQuestion();
}

function renderGrammarReorderQuestion() {
  const s = grammarReorderState;
  document.getElementById("grammar-reorder-feedback-banner").innerHTML = "";
  document.getElementById("grammar-reorder-next-btn").style.display = "none";
  document.getElementById("grammar-reorder-reset-btn").style.display = "";

  const total = s.queue.length;
  document.getElementById("grammar-reorder-progress-label").textContent = `${s.index + 1} / ${total}`;
  document.getElementById("grammar-reorder-progress-bar").style.width = `${(s.index / total) * 100}%`;

  const item = s.queue[s.index];
  const titlePrefix = s.isChallenge ? `【${item.topicTitle}】` : "";
  document.getElementById("grammar-reorder-hint").textContent = `${titlePrefix}次の意味になるように、下の単語を正しい順番にタップしてください：「${item.translation}」`;

  s.tokens = item.tokens;
  s.readings = item.readings;
  s.punctuation = item.punctuation;
  s.placedIndices = [];
  s.bankIndices = shuffle(item.tokens.map((_, i) => i));
  s.answered = false;

  renderGrammarReorderChips();
}

function grammarReorderChipHtml(tokenIndex, extraClass, dataAttr) {
  const s = grammarReorderState;
  const showReading = App.user.settings.showReading;
  return `
    <button class="reorder-chip ${extraClass}" ${dataAttr}>
      <span class="khmer">${s.tokens[tokenIndex]}</span>
      ${showReading ? `<span class="reorder-chip-reading">${s.readings[tokenIndex] || ""}</span>` : ""}
    </button>
  `;
}

function renderGrammarReorderChips() {
  const s = grammarReorderState;

  const answerChipsHtml = s.placedIndices
    .map((tokenIndex, pos) => grammarReorderChipHtml(tokenIndex, "in-answer", `data-pos="${pos}"`))
    .join("");
  const punctuationHtml = s.punctuation
    ? `<span class="reorder-chip reorder-chip-punct khmer">${s.punctuation}</span>`
    : "";
  document.getElementById("grammar-reorder-answer").innerHTML = answerChipsHtml + punctuationHtml;

  document.getElementById("grammar-reorder-bank").innerHTML = s.bankIndices
    .map((tokenIndex) => grammarReorderChipHtml(tokenIndex, "in-bank", `data-token-index="${tokenIndex}"`))
    .join("");

  document.querySelectorAll("#grammar-reorder-answer .reorder-chip.in-answer").forEach((btn) => {
    btn.addEventListener("click", () => moveGrammarReorderChipToBank(Number(btn.dataset.pos)));
  });
  document.querySelectorAll("#grammar-reorder-bank .reorder-chip").forEach((btn) => {
    btn.addEventListener("click", () => moveGrammarReorderChipToAnswer(Number(btn.dataset.tokenIndex)));
  });
}

function moveGrammarReorderChipToAnswer(tokenIndex) {
  const s = grammarReorderState;
  if (s.answered) return;
  s.bankIndices = s.bankIndices.filter((i) => i !== tokenIndex);
  s.placedIndices.push(tokenIndex);
  renderGrammarReorderChips();

  if (s.bankIndices.length === 0) {
    checkGrammarReorderAnswer();
  }
}

function moveGrammarReorderChipToBank(pos) {
  const s = grammarReorderState;
  if (s.answered) return;
  const tokenIndex = s.placedIndices[pos];
  s.placedIndices.splice(pos, 1);
  s.bankIndices.push(tokenIndex);
  renderGrammarReorderChips();
}

function resetGrammarReorderPlacement() {
  const s = grammarReorderState;
  if (!s || s.answered) return;
  s.bankIndices = shuffle(s.tokens.map((_, i) => i));
  s.placedIndices = [];
  renderGrammarReorderChips();
}

function checkGrammarReorderAnswer() {
  const s = grammarReorderState;
  s.answered = true;
  // 同じ単語が文中に複数回登場する場合があるため、元のトークン番号ではなく
  // 実際に置かれた単語の文字列が正しい位置の単語と一致するかで正誤を判定する
  const isCorrect = s.placedIndices.every((tokenIndex, pos) => s.tokens[tokenIndex] === s.tokens[pos]);
  const item = s.queue[s.index];

  document.querySelectorAll("#grammar-reorder-answer .reorder-chip.in-answer").forEach((btn) => {
    btn.classList.add(isCorrect ? "correct" : "incorrect");
  });

  if (isCorrect) {
    s.correctCount++;
    s.xpEarned += GRAMMAR_XP_PER_CORRECT;
    s.goldEarned += GOLD_PER_CORRECT_ANSWER;
    App.user.xp += GRAMMAR_XP_PER_CORRECT;
    App.user.gold = (App.user.gold || 0) + GOLD_PER_CORRECT_ANSWER;
    App.user.level = gamCalcLevel(App.user.xp);
    soundPlayCorrect();
  } else {
    soundPlayIncorrect();
  }

  const banner = document.getElementById("grammar-reorder-feedback-banner");
  banner.innerHTML = `
    <div class="feedback-banner ${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "正解！" : "おしい！"}</div>
    ${isCorrect ? "" : `<div class="reorder-correct-answer">${item.tokens.join(" ")}${item.punctuation}</div>`}
  `;

  if (isCorrect) {
    setTimeout(advanceGrammarReorder, 900);
  } else {
    document.getElementById("grammar-reorder-reset-btn").style.display = "none";
    document.getElementById("grammar-reorder-next-btn").style.display = "";
  }
}

function advanceGrammarReorder() {
  const s = grammarReorderState;
  document.getElementById("grammar-reorder-next-btn").style.display = "none";
  s.index++;
  if (s.index >= s.queue.length) {
    finishGrammarReorderQueue();
  } else {
    renderGrammarReorderQuestion();
  }
}

function finishGrammarReorderQueue() {
  const s = grammarReorderState;
  const total = s.queue.length;

  saveUserState(App.user);
  soundPlaySessionComplete();

  const titleText = s.isChallenge ? "総合並び替えチャレンジの結果" : `「${getGrammarTopic(grammarCurrentTopicId).title}」の並び替えクイズ結果`;
  document.getElementById("grammar-result-hero").innerHTML = `
    <div class="sub">${titleText}</div>
    <div class="big-xp">${s.correctCount} / ${total} 問正解</div>
    <div class="big-gold">+${s.xpEarned} XP　+${s.goldEarned} 🪙</div>
  `;

  grammarResultRetryAction = s.isChallenge
    ? () => startGrammarReorderChallenge()
    : () => startGrammarReorder(grammarCurrentTopicId);
  showGrammarView("result");
}
