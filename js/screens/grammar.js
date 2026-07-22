// 文法画面（一覧・解説カード・クイズ・結果）

const GRAMMAR_QUIZ_PASS_RATIO = 0.6;

let grammarCurrentTopicId = null;
let grammarQuizState = null; // { queue: [...], index, correctCount, xpEarned, goldEarned }

function initGrammarScreen() {
  document.getElementById("grammar-topic-list").addEventListener("click", (e) => {
    const tile = e.target.closest(".grammar-topic-tile");
    if (!tile) return;
    openGrammarTopic(tile.dataset.topicId);
  });

  document.getElementById("grammar-back-to-list-btn").addEventListener("click", () => {
    renderGrammarScreen();
  });

  document.getElementById("grammar-start-quiz-btn").addEventListener("click", () => {
    startGrammarQuiz(grammarCurrentTopicId);
  });

  document.getElementById("grammar-result-retry-btn").addEventListener("click", () => {
    startGrammarQuiz(grammarCurrentTopicId);
  });

  document.getElementById("grammar-result-back-btn").addEventListener("click", () => {
    renderGrammarScreen();
  });
}

function showGrammarView(viewName) {
  ["list", "detail", "quiz", "result"].forEach((name) => {
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
    const xpDelta = 8;
    const goldDelta = GOLD_PER_CORRECT_ANSWER;
    s.xpEarned += xpDelta;
    s.goldEarned += goldDelta;
    App.user.xp += xpDelta;
    App.user.gold = (App.user.gold || 0) + goldDelta;
    App.user.level = gamCalcLevel(App.user.xp);
  }

  const banner = document.getElementById("grammar-quiz-feedback-banner");
  banner.innerHTML = `<div class="feedback-banner ${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "正解！" : "おしい！"}</div>`;

  if (isCorrect) soundPlayCorrect();
  else soundPlayIncorrect();

  setTimeout(() => {
    s.index++;
    if (s.index >= s.queue.length) {
      finishGrammarQuiz();
    } else {
      renderGrammarQuizQuestion();
    }
  }, 900);
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
    <div class="sub">「${topic.title}」の結果</div>
    <div class="big-xp">${s.correctCount} / ${total} 問正解</div>
    <div class="big-gold">+${s.xpEarned} XP　+${s.goldEarned} 🪙</div>
    <div style="margin-top:8px; color:var(--dq-window-text); font-size:13px; opacity:0.85;">
      ${passed ? "このトピックを「学習済み」にしました！" : "もう一度挑戦してみましょう"}
    </div>
  `;

  showGrammarView("result");
}
