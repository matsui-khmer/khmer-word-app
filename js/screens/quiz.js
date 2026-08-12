// クイズ画面: セッション進行の状態管理とDOM描画

function startQuizSession() {
  const today = todayISO();
  const queue = srsBuildSession(App.progress, App.words, today, {
    scope: App.user.settings.quizScope,
    sessionMax: App.user.settings.sessionSize,
  });
  App.session = {
    queue,
    index: 0,
    correctCount: 0,
    comboCount: 0,
    maxCombo: 0,
    xpEarned: 0,
    goldEarned: 0,
    startedNewWordIds: [],
    startLevel: App.user.level,
    startedAt: Date.now(),
    wordLog: [],
  };
  renderQuizScreen();
}

const SRS_SESSION_MAX_MINUTES_CAP = 60; // 放置・バックグラウンド化による学習時間の水増し防止

function initQuizScreen() {
  document.getElementById("quiz-quit-btn").addEventListener("click", () => {
    if (App.session && App.session.index > 0) {
      recordSessionTime(App.session);
      saveUserState(App.user);
    }
    App.session = null;
    navigateTo("home");
  });
}

function recordSessionTime(session) {
  const elapsedMinutes = Math.min((Date.now() - session.startedAt) / 60000, SRS_SESSION_MAX_MINUTES_CAP);
  App.user.totalStudyMinutes = (App.user.totalStudyMinutes || 0) + elapsedMinutes;
}

function currentQuizWord() {
  const s = App.session;
  const wordId = s.queue[s.index];
  return App.words.find((w) => w.id === wordId);
}

function khmerPromptWithAudioHtml(word) {
  if (!hasWordAudio(word.id)) {
    return `<div class="prompt-khmer khmer">${word.khmer}</div>`;
  }
  return `
    <div class="prompt-khmer-wrap">
      <span class="prompt-khmer khmer khmer-tap-audio" data-audio="${word.id}" aria-label="発音を聞く">${word.khmer}</span>
      <button class="audio-btn" data-audio="${word.id}" aria-label="発音を聞く">🔊</button>
    </div>
  `;
}

function renderQuizScreen() {
  const s = App.session;
  if (!s || s.index >= s.queue.length) {
    finishQuizSession();
    return;
  }

  document.getElementById("quiz-feedback-banner").innerHTML = "";
  document.getElementById("quiz-progress-label").textContent =
    `${s.index + 1} / ${s.queue.length}`;
  document.getElementById("quiz-progress-bar").style.width =
    Math.round((s.index / s.queue.length) * 100) + "%";

  const word = currentQuizWord();
  const record = App.progress[word.id];
  const box = record ? record.box : 1;
  const remainingCount = s.queue.length - s.index;
  const type = quizDecideType(box, App.user.settings, remainingCount, hasWordAudio(word.id));
  const cardEl = document.getElementById("quiz-card");
  const answerEl = document.getElementById("quiz-answer-area");

  if (type === "matching") {
    const roundWords = s.queue
      .slice(s.index, s.index + QUIZ_MATCHING_PAIR_COUNT)
      .map((id) => App.words.find((w) => w.id === id));
    const item = quizBuildMatchingItem(roundWords);
    s.currentItem = item;
    renderMatchingRound(item, cardEl, answerEl);
    // フィードバックバナーの表示/非表示でカードの位置がずれても、
    // カード自体のサイズが変わらない場合はResizeObserverが発火しないため、明示的に再計算する
    tutorialOnScreenShown();
    return;
  }

  renderSingleWordQuestion(word, type);
  tutorialOnScreenShown();
}

// リスニング問題を、音を出せない環境向けに別形式へ差し替える（同じ単語・同じ出題位置のまま）
function skipListeningQuestion() {
  const s = App.session;
  const word = currentQuizWord();
  const record = App.progress[word.id];
  const box = record ? record.box : 1;
  const remainingCount = s.queue.length - s.index;
  const type = quizDecideType(box, App.user.settings, remainingCount, false); // 音声問題を除外して再抽選
  renderSingleWordQuestion(word, type);
}

function renderSingleWordQuestion(word, type) {
  const s = App.session;
  const cardEl = document.getElementById("quiz-card");
  const answerEl = document.getElementById("quiz-answer-area");

  const item = quizBuildItem(word, App.words, type);
  s.currentItem = item;

  const showReading = App.user.settings.showReading;
  const readingHtml =
    item.type !== "jp2km" && word.reading
      ? `<div class="prompt-reading">${readingWithIpaHtml(word)}</div>`
      : "";

  if (item.type === "flashcard") {
    cardEl.innerHTML = `
      ${khmerPromptWithAudioHtml(word)}
      ${showReading ? readingHtml : ""}
      <div class="quiz-hint">意味を考えてみましょう</div>
    `;
    answerEl.innerHTML = `
      <div class="flashcard-actions" id="flashcard-hidden">
        <button class="secondary-button" id="flashcard-reveal-btn" style="grid-column: span 2;">こたえを見る</button>
      </div>
    `;
    document.getElementById("flashcard-reveal-btn").addEventListener("click", () => {
      cardEl.querySelector(".prompt-khmer-wrap").insertAdjacentHTML(
        "afterend",
        `<div class="prompt-meaning">${word.meaning}</div>`
      );
      cardEl.querySelector(".quiz-hint").textContent = "意味が合っていたらタップ";
      answerEl.innerHTML = `
        <div class="flashcard-actions">
          <button class="dontknow-btn" id="flashcard-no-btn">間違っていた</button>
          <button class="know-btn" id="flashcard-yes-btn">合っていた</button>
        </div>
      `;
      document.getElementById("flashcard-yes-btn").addEventListener("click", () => handleAnswer(true));
      document.getElementById("flashcard-no-btn").addEventListener("click", () => handleAnswer(false));
    });
    return;
  }

  if (item.type === "truefalse") {
    cardEl.innerHTML = `
      ${khmerPromptWithAudioHtml(word)}
      ${showReading ? readingHtml : ""}
      <div class="quiz-hint">この意味で合っている？</div>
      <div class="prompt-meaning">${item.displayedMeaning}</div>
    `;
    answerEl.innerHTML = `
      <div class="choice-grid">
        <button class="choice-btn truefalse-btn" data-answer="true">○ 合っている</button>
        <button class="choice-btn truefalse-btn" data-answer="false">× 違う</button>
      </div>
    `;
    answerEl.querySelectorAll(".truefalse-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleTrueFalseClick(btn.dataset.answer === "true"));
    });
    return;
  }

  if (item.type === "listening") {
    cardEl.innerHTML = `
      <button class="audio-btn listening-play-btn" data-audio="${word.id}" aria-label="発音を聞く">🔊</button>
      <div class="quiz-hint">音声を聞いて、正しい意味を選んでください</div>
    `;
    playWordAudio(word.id);

    answerEl.innerHTML = `
      <div class="choice-grid">
        ${item.choices
          .map((c, i) => `<button class="choice-btn" data-index="${i}">${c.label}</button>`)
          .join("")}
      </div>
      <button class="secondary-button" id="listening-skip-btn" style="margin-top:10px;">🔇 音が出せないのでスキップ</button>
    `;
    answerEl.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleChoiceClick(Number(btn.dataset.index)));
    });
    document.getElementById("listening-skip-btn").addEventListener("click", skipListeningQuestion);
    return;
  }

  // 4択（km2jp / jp2km）
  const promptHtml =
    item.type === "km2jp"
      ? `${khmerPromptWithAudioHtml(word)}${showReading ? readingHtml : ""}<div class="quiz-hint">正しい意味を選んでください</div>`
      : `<div class="prompt-meaning">${word.meaning}</div><div class="quiz-hint">正しいクメール語を選んでください</div>`;
  cardEl.innerHTML = promptHtml;

  const isKhmerChoice = item.type === "jp2km";
  answerEl.innerHTML = `
    <div class="choice-grid">
      ${item.choices
        .map((c, i) => {
          const choiceReadingHtml =
            isKhmerChoice && showReading
              ? (() => {
                  const cw = App.words.find((w) => w.id === c.wordId);
                  return cw && cw.reading ? `<span class="choice-reading">${readingWithIpaHtml(cw)}</span>` : "";
                })()
              : "";
          const choiceBtnHtml = `<button class="choice-btn ${isKhmerChoice ? "khmer" : ""}" data-index="${i}">${c.label}${choiceReadingHtml}</button>`;
          if (!isKhmerChoice || !hasWordAudio(c.wordId)) return choiceBtnHtml;
          return `
            <div class="choice-audio-wrap">
              ${choiceBtnHtml}
              <button class="audio-btn small" data-audio="${c.wordId}" aria-label="発音を聞く">🔊</button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
  answerEl.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleChoiceClick(Number(btn.dataset.index)));
  });
}

function handleTrueFalseClick(userSaysTrue) {
  const s = App.session;
  const item = s.currentItem;
  const isCorrect = userSaysTrue === item.isStatementTrue;

  document.querySelectorAll(".truefalse-btn").forEach((btn) => {
    btn.disabled = true;
    const btnSaysTrue = btn.dataset.answer === "true";
    if (btnSaysTrue === item.isStatementTrue) btn.classList.add("correct");
    else if (btnSaysTrue === userSaysTrue) btn.classList.add("incorrect");
  });

  if (!item.isStatementTrue) {
    document.getElementById("quiz-card").insertAdjacentHTML(
      "beforeend",
      `<div class="quiz-correct-reveal">正しい意味: ${item.word.meaning}</div>`
    );
  }

  setTimeout(() => handleAnswer(isCorrect), 700);
}

// ---------- マッチングゲーム（複数単語を同時に出題） ----------

function renderMatchingRound(item, cardEl, answerEl) {
  cardEl.innerHTML = `
    <div class="quiz-hint">同じ単語同士をタップしてつなげよう（${item.words.length}組）</div>
  `;

  // クメール語側・意味側を行ごとに交互に並べ、同じ行のセル同士の高さがCSS Gridで自動的に揃うようにする
  const rowsHtml = item.khmerOrder
    .map((khmerId, i) => {
      const meaningId = item.meaningOrder[i];
      const kw = App.words.find((x) => x.id === khmerId);
      const mw = App.words.find((x) => x.id === meaningId);
      const readingHtml =
        App.user.settings.showReading && kw.reading
          ? `<span class="matching-reading">${readingWithIpaHtml(kw)}</span>`
          : "";
      const khmerTileHtml = `<button class="matching-tile" data-side="khmer" data-id="${khmerId}"><span class="khmer">${kw.khmer}</span>${readingHtml}</button>`;
      const khmerCellHtml = hasWordAudio(khmerId)
        ? `<div class="matching-tile-wrap">${khmerTileHtml}<button class="audio-btn small" data-audio="${khmerId}" aria-label="発音を聞く">🔊</button></div>`
        : khmerTileHtml;
      const meaningCellHtml = `<button class="matching-tile" data-side="meaning" data-id="${meaningId}">${mw.meaning}</button>`;
      return khmerCellHtml + meaningCellHtml;
    })
    .join("");

  answerEl.innerHTML = `<div class="matching-board">${rowsHtml}</div>`;

  App.session.matchingState = {
    words: item.words,
    mistakes: new Set(),
    selectedKhmerBtn: null,
    selectedMeaningBtn: null,
  };

  answerEl.querySelectorAll('.matching-tile[data-side="khmer"]').forEach((btn) => {
    btn.addEventListener("click", () => selectMatchingTile("selectedKhmerBtn", btn));
  });
  answerEl.querySelectorAll('.matching-tile[data-side="meaning"]').forEach((btn) => {
    btn.addEventListener("click", () => selectMatchingTile("selectedMeaningBtn", btn));
  });
}

function selectMatchingTile(slot, btn) {
  if (btn.disabled) return;
  const state = App.session.matchingState;

  if (state[slot]) state[slot].classList.remove("selected");
  state[slot] = btn;
  btn.classList.add("selected");

  if (!state.selectedKhmerBtn || !state.selectedMeaningBtn) return;

  const khmerBtn = state.selectedKhmerBtn;
  const meaningBtn = state.selectedMeaningBtn;
  const isMatch = khmerBtn.dataset.id === meaningBtn.dataset.id;

  if (isMatch) {
    [khmerBtn, meaningBtn].forEach((b) => {
      b.disabled = true;
      b.classList.remove("selected");
      b.classList.add("matched");
    });
    soundPlayCorrect();
  } else {
    state.mistakes.add(khmerBtn.dataset.id);
    state.mistakes.add(meaningBtn.dataset.id);
    [khmerBtn, meaningBtn].forEach((b) => b.classList.add("mismatch"));
    soundPlayIncorrect();
    setTimeout(() => {
      [khmerBtn, meaningBtn].forEach((b) => b.classList.remove("selected", "mismatch"));
    }, 500);
  }

  state.selectedKhmerBtn = null;
  state.selectedMeaningBtn = null;

  const stillUnmatched = document.querySelectorAll(".matching-tile:not(.matched)").length > 0;
  if (!stillUnmatched) {
    setTimeout(() => finishMatchingRound(), 400);
  }
}

function finishMatchingRound() {
  const s = App.session;
  const { words, mistakes } = s.matchingState;
  const today = todayISO();
  const now = new Date().toISOString();
  let anyMistake = false;
  let roundXp = 0;
  let roundGold = 0;

  words.forEach((word) => {
    const isCorrect = !mistakes.has(word.id);
    if (!isCorrect) anyMistake = true;

    const isNewWord = !App.progress[word.id];
    const prevRecord = App.progress[word.id] || srsCreateNewRecord(today);
    const wasStruggling = prevRecord.box === 1 && (prevRecord.correctCount > 0 || prevRecord.incorrectCount > 0);
    App.progress[word.id] = srsApplyAnswer(prevRecord, isCorrect, today, now);

    if (isCorrect) s.correctCount++;
    if (isNewWord) s.startedNewWordIds.push(word.id);
    App.user.totalAnsweredCount = (App.user.totalAnsweredCount || 0) + 1;
    s.wordLog.push({ word, isCorrect });

    roundXp += gamCalcXpDelta({
      isCorrect,
      isNewWord,
      comboCount: 0,
      isComeback: isCorrect && wasStruggling,
    });
    roundGold += gamCalcGoldDelta(isCorrect);
    tutorialNotifyAnswered();
  });

  saveProgress(App.progress);

  s.comboCount = anyMistake ? 0 : s.comboCount + words.length;
  s.maxCombo = Math.max(s.maxCombo, s.comboCount);
  s.xpEarned += roundXp;
  s.goldEarned += roundGold;
  App.user.xp += roundXp;
  App.user.gold = (App.user.gold || 0) + roundGold;
  App.user.level = gamCalcLevel(App.user.xp);

  showFeedbackBanner(!anyMistake, roundXp);

  setTimeout(() => {
    s.index += words.length;
    s.matchingState = null;
    renderQuizScreen();
  }, 900);
}

function handleChoiceClick(index) {
  const s = App.session;
  const item = s.currentItem;
  const isCorrect = item.choices[index].isCorrect;

  document.querySelectorAll(".choice-btn").forEach((btn, i) => {
    btn.disabled = true;
    if (item.choices[i].isCorrect) btn.classList.add("correct");
    else if (i === index && !isCorrect) btn.classList.add("incorrect");
  });

  setTimeout(() => handleAnswer(isCorrect), 700);
}

function handleAnswer(isCorrect) {
  const s = App.session;
  const word = currentQuizWord();
  const today = todayISO();
  const now = new Date().toISOString();

  const isNewWord = !App.progress[word.id];
  const prevRecord = App.progress[word.id] || srsCreateNewRecord(today);
  const wasStruggling = prevRecord.box === 1 && (prevRecord.correctCount > 0 || prevRecord.incorrectCount > 0);

  App.progress[word.id] = srsApplyAnswer(prevRecord, isCorrect, today, now);
  saveProgress(App.progress);

  s.comboCount = isCorrect ? s.comboCount + 1 : 0;
  s.maxCombo = Math.max(s.maxCombo, s.comboCount);
  if (isCorrect) s.correctCount++;
  if (isNewWord) s.startedNewWordIds.push(word.id);
  App.user.totalAnsweredCount = (App.user.totalAnsweredCount || 0) + 1;
  s.wordLog.push({ word, isCorrect });

  const xpDelta = gamCalcXpDelta({
    isCorrect,
    isNewWord,
    comboCount: s.comboCount,
    isComeback: isCorrect && wasStruggling,
  });
  s.xpEarned += xpDelta;
  App.user.xp += xpDelta;
  App.user.level = gamCalcLevel(App.user.xp);

  const goldDelta = gamCalcGoldDelta(isCorrect);
  s.goldEarned += goldDelta;
  App.user.gold = (App.user.gold || 0) + goldDelta;

  if (isCorrect) soundPlayCorrect();
  else soundPlayIncorrect();

  showFeedbackBanner(isCorrect, xpDelta);
  tutorialNotifyAnswered();

  const waitForTap = !isCorrect && App.user.settings.advanceOnWrong === "tap";
  if (waitForTap) {
    showQuizNextButton();
  } else {
    setTimeout(() => advanceToNextQuestion(), 900);
  }
}

function advanceToNextQuestion() {
  const s = App.session;
  s.index++;
  renderQuizScreen();
}

function showQuizNextButton() {
  const el = document.getElementById("quiz-feedback-banner");
  el.insertAdjacentHTML(
    "beforeend",
    `<button class="cta-button quiz-next-btn" id="quiz-next-btn">次の問題へ</button>`
  );
  document.getElementById("quiz-next-btn").addEventListener("click", advanceToNextQuestion);
}

function showFeedbackBanner(isCorrect, xpDelta) {
  const el = document.getElementById("quiz-feedback-banner");
  el.innerHTML = `<div class="feedback-banner ${isCorrect ? "correct" : "incorrect"}">
    ${isCorrect ? `正解！ +${xpDelta}XP` : "おしい！また出てきます"}
  </div>`;
}

function finishQuizSession() {
  const s = App.session;
  const today = todayISO();
  recordSessionTime(s);
  saveUserState(App.user);

  const isPerfect = s.correctCount === s.queue.length && s.queue.length > 0;
  gamUpdateStreak(App.user, today);
  gamUpdateDailyProgress(App.user, today, s.queue.length);
  App.user.totalSessionsCompleted = (App.user.totalSessionsCompleted || 0) + 1;
  App.user.longestCombo = Math.max(App.user.longestCombo || 0, s.maxCombo || 0);

  const newBadges = gamCheckNewBadges({
    userState: App.user,
    progress: App.progress,
    words: App.words,
    lastSessionPerfect: isPerfect,
  });
  newBadges.forEach((b) => App.user.badges.push(b.id));
  saveUserState(App.user);

  const leveledUp = App.user.level > s.startLevel;
  const newRankTitle = gamGetRankTitle(App.user.level);
  const titleChanged = leveledUp && gamGetRankTitle(s.startLevel) !== newRankTitle;

  App.lastResult = {
    xpEarned: s.xpEarned,
    goldEarned: s.goldEarned,
    total: s.queue.length,
    correctCount: s.correctCount,
    newBadges,
    leveledUp,
    titleChanged,
    newLevel: App.user.level,
    newRankTitle,
    wordLog: s.wordLog,
  };
  App.session = null;
  navigateTo("result");
}
