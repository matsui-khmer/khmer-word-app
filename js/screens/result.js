// 結果画面

function initResultScreen() {
  document.getElementById("result-again-btn").addEventListener("click", () => {
    const today = todayISO();
    const nextQueue = srsBuildSession(App.progress, App.words, today, {
      scope: App.user.settings.quizScope,
      sessionMax: App.user.settings.sessionSize,
    });
    if (nextQueue.length === 0) {
      navigateTo("home");
      return;
    }
    startQuizSession();
    navigateTo("quiz");
  });
  document.getElementById("result-home-btn").addEventListener("click", () => {
    navigateTo("home");
  });
}

function renderResultScreen() {
  const r = App.lastResult;
  if (!r) {
    navigateTo("home");
    return;
  }

  document.getElementById("result-xp").textContent = `+${r.xpEarned} XP`;
  document.getElementById("result-gold").textContent = `+${r.goldEarned || 0} 🪙`;
  document.getElementById("result-summary").textContent =
    `${r.total}問中 ${r.correctCount}問正解`;

  soundPlaySessionComplete();

  const levelupEl = document.getElementById("result-levelup");
  if (r.leveledUp) {
    const rankLine = r.titleChanged
      ? `<div class="levelup-rank">称号「${r.newRankTitle}」を獲得！</div>`
      : "";
    levelupEl.innerHTML = `
      <div class="levelup-banner dq-window dq-window-frame">
        <div class="levelup-title">LEVEL UP! Lv.${r.newLevel}</div>
        ${rankLine}
      </div>
    `;
    soundPlayLevelUp();
  } else {
    levelupEl.innerHTML = "";
  }

  const badgesEl = document.getElementById("result-badges");
  if (r.newBadges && r.newBadges.length > 0) {
    badgesEl.innerHTML = r.newBadges
      .map(
        (b) => `<div class="badge-earned">${b.icon} 新しいバッジ「${b.name}」を獲得！</div>`
      )
      .join("");
    if (!r.leveledUp) soundPlayBadge();
  } else {
    badgesEl.innerHTML = "";
  }

  renderResultWordLog(r.wordLog);
}

function renderResultWordLog(wordLog) {
  const logEl = document.getElementById("result-word-log");
  if (!wordLog || wordLog.length === 0) {
    logEl.innerHTML = "";
    return;
  }
  const showReading = App.user.settings.showReading;
  logEl.innerHTML = `
    <div class="result-log-title">今回出てきた単語（${wordLog.length}語）</div>
    <div class="result-log">
      ${wordLog
        .map(({ word, isCorrect }) => {
          const readingHtml =
            showReading && word.reading
              ? `<div class="result-log-reading">${readingWithIpaHtml(word)}</div>`
              : "";
          return `
            <div class="result-log-item ${isCorrect ? "correct" : "incorrect"}">
              <span class="result-log-status">${isCorrect ? "○" : "×"}</span>
              <div class="result-log-word">
                <div class="result-log-khmer khmer">${word.khmer}</div>
                ${readingHtml}
              </div>
              <div class="result-log-meaning">${word.meaning}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}
