// 実際の画面を操作しながら進めるチュートリアル（学習者ごとに最初の1回だけ）
// advance: "manual"（ボタンで進める）/ "click"（対象を実際にタップすると進む）/ "answer"（実際に問題に回答すると進む。
// 画面が次のステップの画面に自然に切り替わったタイミングで進む）

let _tutorialSavedSessionSize = null;

const TUTORIAL_STEPS = [
  {
    screen: "home",
    selectors: [".hero"],
    text: "クメール語単語帳へようこそ！毎日少しずつ単語を覚えていきましょう。",
    advance: "manual",
  },
  {
    screen: "home",
    selectors: ["#home-start-btn"],
    text: "ここを押して、実際に学習をはじめてみましょう！",
    advance: "click",
    onEnter: () => {
      // チュートリアル用に、このセッションだけ10問で終わるようにする
      _tutorialSavedSessionSize = App.user.settings.sessionSize;
      App.user.settings.sessionSize = 10;
    },
  },
  {
    screen: "quiz",
    selectors: ["#quiz-card", "#quiz-answer-area"],
    text: "問題が出ました。実際に10問解いてみましょう！",
    advance: "answer",
    requiredCount: 10,
    onEnter: () => {
      if (_tutorialSavedSessionSize != null) {
        App.user.settings.sessionSize = _tutorialSavedSessionSize;
        _tutorialSavedSessionSize = null;
      }
    },
  },
  {
    screen: "result",
    selectors: [".result-hero", "#result-word-log"],
    text: "おつかれさまでした！獲得したXP・ゴールドと、今回出てきた単語の一覧（○正解・×不正解）が確認できます。",
    advance: "manual",
    onEnter: () => {
      // 10問終えてもガチャを試せるだけのゴールドがなければ、体験用に補填する
      if ((App.user.gold || 0) < GACHA_SINGLE_COST) {
        App.user.gold = GACHA_SINGLE_COST;
        saveUserState(App.user);
      }
    },
  },
  {
    screen: "result",
    selectors: ['.bottom-nav a[data-screen="shop"]'],
    text: "正解するとゴールドが貯まります。「ショップ」を押してみましょう。",
    advance: "click",
  },
  {
    screen: "shop",
    selectors: ["#gacha-pull-single-btn"],
    text: "ここを押して、実際にガチャを引いてみましょう！",
    advance: "click",
  },
  {
    screen: "shop",
    selectors: ['#shop-tabs .filter-chip[data-tab="collection"]'],
    text: "引いたアイテムは「コレクション」で確認できます。押してみましょう。",
    advance: "click",
  },
  {
    screen: "shop",
    selectors: ["#shop-tab-collection"],
    text: "手に入れたアイテムの名前・入手回数・詳細が確認できます。未入手のものは？？？と表示されます。",
    advance: "manual",
  },
  {
    screen: "shop",
    selectors: ['.bottom-nav a[data-screen="wordlist"]'],
    text: "続けて「図鑑」を見てみましょう。押してみましょう。",
    advance: "click",
  },
  {
    screen: "wordlist",
    selectors: ["#wordlist-filters"],
    text: "ここが単語図鑑です。「すべて」「超重要70選」のほか、理解度別に「❔未出題」「⚠️苦手」「🌱学習中」「🛡️定着」「⭐マスター」で絞り込めます。単語もこの理解度で色分けされています。",
    advance: "manual",
  },
  {
    screen: "wordlist",
    selectors: ['.bottom-nav a[data-screen="achievements"]'],
    text: "次は「実績」を見てみましょう。押してみましょう。",
    advance: "click",
  },
  {
    screen: "achievements",
    selectors: ["#achievements-tabs", "#achievements-tab-level"],
    text: "レベルや獲得したバッジ、称号をタブで切り替えて確認できます。",
    advance: "manual",
  },
  {
    screen: "achievements",
    selectors: ['.bottom-nav a[data-screen="settings"]'],
    text: "最後に「設定」を見てみましょう。押してみましょう。",
    advance: "click",
  },
  {
    screen: "settings",
    selectors: ["#settings-toggles-card"],
    text: "読み仮名の表示・日本語→クメール語の出題・効果音のON/OFFを切り替えられます。",
    advance: "manual",
  },
  {
    screen: "settings",
    selectors: ["#settings-scope-card", "#settings-session-size-card", "#settings-daily-goal-card", "#setting-reset-btn"],
    text: "出題範囲・1回の出題数・1日の目標問題数を設定できます。困ったときは「学習データをリセットする」からやり直すこともできます。",
    advance: "manual",
    finalText: "とじる",
  },
];

let tutorialStepIndex = -1; // -1: 非アクティブ
let tutorialClickTarget = null;
let tutorialClickHandler = null;
let tutorialAnswerCount = 0;
let tutorialResizeObserver = null;

function initTutorial() {
  document.getElementById("tutorial-skip-btn").addEventListener("click", closeTutorial);
  document.getElementById("tutorial-next-btn").addEventListener("click", advanceTutorialStep);
  window.addEventListener("resize", () => {
    if (tutorialStepIndex >= 0) positionTutorialSpotlight();
  });
}

// ユーザーが一度もチュートリアルを見ていなければ表示する（学習者ごとに判定）
function maybeShowTutorial() {
  if (App.user.hasSeenTutorial) return;
  enterTutorialStep(0);
}

// 画面遷移後にも呼ばれる。現在のステップが今の画面向けでなければ、そのステップの画面になるまで待つ
// （次のステップの画面と一致する場合は、実際の操作の結果として自然に進んだとみなして進める）
function tutorialOnScreenShown() {
  if (tutorialStepIndex < 0) return;
  renderTutorialStep();
}

function enterTutorialStep(index) {
  tutorialStepIndex = index;
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  if (!step) {
    closeTutorial();
    return;
  }
  if (step.advance === "answer") tutorialAnswerCount = 0;
  if (step.onEnter) step.onEnter();
  renderTutorialStep();
}

// 「」で囲まれた語が行の途中で分割されないようにし、文の区切り（。！）ごとに改行して読みやすくする
function formatTutorialText(text) {
  const withNowrap = text.replace(/「[^」]+」/g, (m) => `<span class="tutorial-nowrap">${m}</span>`);
  return withNowrap.replace(/([。！])(?!$)/g, "$1<br>");
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  const overlay = document.getElementById("tutorial-overlay");

  if (!step) {
    closeTutorial();
    return;
  }
  if (currentScreenNameFromHash() !== step.screen) {
    const nextStep = TUTORIAL_STEPS[tutorialStepIndex + 1];
    if (nextStep && nextStep.screen === currentScreenNameFromHash()) {
      enterTutorialStep(tutorialStepIndex + 1);
      return;
    }
    overlay.classList.remove("active");
    return;
  }
  const targets = step.selectors.map((sel) => document.querySelector(sel)).filter(Boolean);
  if (targets.length === 0) {
    overlay.classList.remove("active");
    return;
  }

  overlay.classList.add("active");
  const progressSuffix =
    step.advance === "answer" && step.requiredCount ? `（${tutorialAnswerCount}/${step.requiredCount}問）` : "";
  document.getElementById("tutorial-body").innerHTML = formatTutorialText(step.text + progressSuffix);

  const nextBtn = document.getElementById("tutorial-next-btn");
  nextBtn.style.display = step.advance === "manual" ? "" : "none";
  nextBtn.textContent = step.finalText || "次へ";

  positionTutorialSpotlight();

  if (tutorialResizeObserver) tutorialResizeObserver.disconnect();
  tutorialResizeObserver = new ResizeObserver(() => positionTutorialSpotlight());
  targets.forEach((el) => tutorialResizeObserver.observe(el));

  if (tutorialClickTarget && tutorialClickHandler) {
    tutorialClickTarget.removeEventListener("click", tutorialClickHandler);
  }
  if (step.advance === "click") {
    // クリックによる画面遷移が、下のtutorialOnScreenShown経由の自動進行と二重に進めてしまわないよう、
    // クリック時点のステップ番号を覚えておき、まだ同じステップのままの時だけ進める
    const capturedIndex = tutorialStepIndex;
    tutorialClickTarget = targets[0];
    tutorialClickHandler = () => {
      setTimeout(() => {
        if (tutorialStepIndex === capturedIndex) advanceTutorialStep();
      }, 100);
    };
    tutorialClickTarget.addEventListener("click", tutorialClickHandler, { once: true });
  } else {
    tutorialClickTarget = null;
    tutorialClickHandler = null;
  }
}

// quiz.jsから、実際に1単語分の正誤判定が行われたタイミングで呼ばれる（マッチングは単語ごとに複数回）
// 進捗の表示だけ更新する。次のステップへ進むのは、セッションが終わり画面が自然に切り替わったタイミング
function tutorialNotifyAnswered() {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  if (!step || step.advance !== "answer") return;
  if (!document.getElementById("tutorial-overlay").classList.contains("active")) return;
  tutorialAnswerCount++;
  renderTutorialStep();
}

function advanceTutorialStep() {
  enterTutorialStep(tutorialStepIndex + 1);
}

function positionTutorialSpotlight() {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  if (!step) return;
  const targets = step.selectors.map((sel) => document.querySelector(sel)).filter(Boolean);
  if (targets.length === 0) return;

  const rects = targets.map((el) => el.getBoundingClientRect());
  const pad = 6;
  const top = Math.min(...rects.map((r) => r.top)) - pad;
  const left = Math.min(...rects.map((r) => r.left)) - pad;
  const right = Math.max(...rects.map((r) => r.right)) + pad;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + pad;

  const spot = document.getElementById("tutorial-spotlight");
  spot.style.top = top + "px";
  spot.style.left = left + "px";
  spot.style.width = right - left + "px";
  spot.style.height = bottom - top + "px";

  const tooltip = document.getElementById("tutorial-tooltip");

  // スポットライトが画面の大部分を占めるほど大きい場合、上下どちらに寄せても窮屈になるため、
  // 画面中央に表示する
  if (bottom - top > window.innerHeight * 0.6) {
    tooltip.style.top = "50%";
    tooltip.style.bottom = "auto";
    tooltip.style.transform = "translateY(-50%)";
    return;
  }
  tooltip.style.transform = "none";

  // 対象がビューポートより大きい場合でも、ツールチップは画面内に収まるよう上下端でクランプする
  const clampedTop = Math.max(top, 0);
  const clampedBottom = Math.min(bottom, window.innerHeight);
  const spaceBelow = window.innerHeight - clampedBottom;
  const spaceAbove = clampedTop;
  if (spaceBelow >= spaceAbove) {
    tooltip.style.top = clampedBottom + 14 + "px";
    tooltip.style.bottom = "auto";
  } else {
    tooltip.style.bottom = window.innerHeight - clampedTop + 14 + "px";
    tooltip.style.top = "auto";
  }
}

function closeTutorial() {
  tutorialStepIndex = -1;
  if (tutorialResizeObserver) tutorialResizeObserver.disconnect();
  tutorialResizeObserver = null;
  if (tutorialClickTarget && tutorialClickHandler) {
    tutorialClickTarget.removeEventListener("click", tutorialClickHandler);
  }
  tutorialClickTarget = null;
  tutorialClickHandler = null;
  document.getElementById("tutorial-overlay").classList.remove("active");
  App.user.hasSeenTutorial = true;
  saveUserState(App.user);
  showTutorialCompleteBanner();
}

// チュートリアル終了を分かりやすくするため、完了バナーを一時的に表示する
function showTutorialCompleteBanner() {
  const el = document.getElementById("tutorial-complete-banner");
  el.classList.add("active");
  soundPlayBadge();
  setTimeout(() => el.classList.remove("active"), 2200);
}
