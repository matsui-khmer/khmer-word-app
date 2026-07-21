// アプリ全体の状態管理・画面ルーティング・初期化

const App = {
  words: KHMER_WORDS,
  progress: null,
  user: null,
  session: null,
  lastResult: null,
};

const SCREEN_RENDERERS = {
  home: renderHomeScreen,
  quiz: null, // startQuizSession()内で描画するためここでは何もしない
  result: renderResultScreen,
  wordlist: renderWordlistScreen,
  achievements: renderAchievementsScreen,
  shop: renderShopScreen,
  settings: renderSettingsScreen,
};

function navigateTo(screenName) {
  window.location.hash = "#" + screenName;
}

function showScreen(screenName) {
  if (!document.getElementById("screen-" + screenName)) screenName = "home";

  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById("screen-" + screenName).classList.add("active");

  document.querySelectorAll(".bottom-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.screen === screenName);
  });

  const renderer = SCREEN_RENDERERS[screenName];
  if (renderer) renderer();

  tutorialOnScreenShown();
}

function currentScreenNameFromHash() {
  const hash = window.location.hash.replace("#", "");
  return hash || "home";
}

function initSettingsScreen() {
  document.getElementById("setting-show-reading").addEventListener("change", (e) => {
    App.user.settings.showReading = e.target.checked;
    saveUserState(App.user);
  });
  document.getElementById("setting-enable-jp-to-km").addEventListener("change", (e) => {
    App.user.settings.enableJpToKm = e.target.checked;
    saveUserState(App.user);
  });
  document.getElementById("setting-sound-enabled").addEventListener("change", (e) => {
    App.user.settings.soundEnabled = e.target.checked;
    saveUserState(App.user);
  });
  document.querySelectorAll('input[name="quiz-scope"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      App.user.settings.quizScope = e.target.value;
      saveUserState(App.user);
    });
  });
  document.querySelectorAll('input[name="session-size"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      App.user.settings.sessionSize = Number(e.target.value);
      saveUserState(App.user);
    });
  });
  document.querySelectorAll('input[name="daily-goal"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      App.user.settings.dailyGoal = Number(e.target.value);
      saveUserState(App.user);
    });
  });
  document.getElementById("setting-reset-btn").addEventListener("click", () => {
    if (!confirm("学習データをすべてリセットします。よろしいですか？")) return;
    resetAllData();
    App.progress = loadProgress();
    App.user = loadUserState();
    navigateTo("home");
  });
}

function renderSettingsScreen() {
  document.getElementById("setting-show-reading").checked = App.user.settings.showReading;
  document.getElementById("setting-enable-jp-to-km").checked = App.user.settings.enableJpToKm;
  document.getElementById("setting-sound-enabled").checked = App.user.settings.soundEnabled;
  document.getElementById("setting-scope-all").checked = App.user.settings.quizScope === "all";
  document.getElementById("setting-scope-core70").checked = App.user.settings.quizScope === "core70";

  document.querySelectorAll('input[name="session-size"]').forEach((radio) => {
    radio.checked = Number(radio.value) === App.user.settings.sessionSize;
  });
  document.querySelectorAll('input[name="daily-goal"]').forEach((radio) => {
    radio.checked = Number(radio.value) === App.user.settings.dailyGoal;
  });

  document.getElementById("setting-version-info").textContent = `バージョン ${APP_VERSION}（${APP_VERSION_DATE}）`;
}

function initApp() {
  App.progress = loadProgress();
  App.user = loadUserState();

  initHomeScreen();
  initQuizScreen();
  initResultScreen();
  initWordlistScreen();
  initAchievementsScreen();
  initShopScreen();
  initSettingsScreen();
  initProfileSwitcher();
  initTutorial();

  window.addEventListener("hashchange", () => showScreen(currentScreenNameFromHash()));
  showScreen(currentScreenNameFromHash());
  maybeShowTutorial();

  // ボタン全般のクリック音（正誤専用音を鳴らす選択肢・フラッシュカードボタンは除外）
  document.addEventListener("click", (e) => {
    const audioBtn = e.target.closest(".audio-btn, .khmer-tap-audio");
    if (audioBtn) {
      playWordAudio(audioBtn.dataset.audio);
      return; // 発音再生時はクリック音を鳴らさない
    }
    const target = e.target.closest("button, .bottom-nav a, .filter-chip");
    if (!target) return;
    if (target.closest(".choice-grid") || target.closest(".flashcard-actions") || target.closest(".matching-board")) return;
    if (target.id === "home-start-btn") return; // 専用の出発SEを別途鳴らすため、通常のクリック音は鳴らさない
    soundPlayClick();
  });

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", initApp);
