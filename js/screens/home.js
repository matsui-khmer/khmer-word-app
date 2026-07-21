// ホーム画面

function initHomeScreen() {
  document.getElementById("home-start-btn").addEventListener("click", () => {
    soundPlayAdventureStart();
    startQuizSession();
    navigateTo("quiz");
  });
}

function renderHomeScreen() {
  const user = App.user;
  const today = todayISO();
  const dueCount = srsBuildSession(App.progress, App.words, today, {
    scope: user.settings.quizScope,
    sessionMax: user.settings.sessionSize,
  }).length;

  document.getElementById("home-profile-name").textContent = getCurrentProfile().name;

  document.getElementById("home-streak").textContent = user.streakDays;
  document.getElementById("home-level").textContent = user.level;
  document.getElementById("home-due-count").textContent = dueCount;
  document.getElementById("home-xp").textContent = user.xp;
  document.getElementById("home-rank-title").textContent = gamGetRankTitle(user.level);
  document.getElementById("home-total-days").textContent = user.totalStudyDays || 0;
  document.getElementById("home-total-time").textContent = formatStudyMinutes(user.totalStudyMinutes);

  const dp = user.dailyProgress && user.dailyProgress.date === today ? user.dailyProgress.count : 0;
  const goal = user.settings.dailyGoal;
  document.getElementById("home-goal-label").textContent =
    `${dp} / ${goal}問（残り${Math.max(0, goal - dp)}問）`;
  document.getElementById("home-goal-bar").style.width = Math.min(100, (dp / goal) * 100) + "%";

  const nextLevelXp = gamXpForNextLevel(user.level);
  const startBtn = document.getElementById("home-start-btn");
  const xpBar = document.getElementById("home-xp-bar");
  const xpNextLabel = document.getElementById("home-xp-next");

  if (nextLevelXp == null) {
    xpBar.style.width = "100%";
    xpNextLabel.textContent = "最大レベルです！";
  } else {
    const prevLevelXp = LEVEL_TABLE[user.level - 1] || 0;
    const progressRatio = (user.xp - prevLevelXp) / (nextLevelXp - prevLevelXp);
    xpBar.style.width = Math.max(0, Math.min(100, progressRatio * 100)) + "%";
    xpNextLabel.textContent = `次のレベルまで あと${nextLevelXp - user.xp}`;
  }

  if (dueCount === 0) {
    startBtn.textContent = "今日の分はすべて完了！おつかれさま";
    startBtn.disabled = true;
  } else {
    startBtn.textContent = `今日の学習をはじめる（${dueCount}問）`;
    startBtn.disabled = false;
  }
}

