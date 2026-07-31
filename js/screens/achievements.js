// 実績・レベル画面

let achievementsCurrentTab = "level";

function initAchievementsScreen() {
  document.querySelectorAll("#achievements-tabs .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      achievementsCurrentTab = chip.dataset.tab;
      document
        .querySelectorAll("#achievements-tabs .filter-chip")
        .forEach((c) => c.classList.toggle("active", c === chip));
      renderAchievementsTabs();
    });
  });
}

function renderAchievementsTabs() {
  ["level", "badges", "titles"].forEach((tab) => {
    document.getElementById("achievements-tab-" + tab).style.display =
      tab === achievementsCurrentTab ? "" : "none";
  });
}

function renderAchievementsScreen() {
  const user = App.user;
  document.getElementById("ach-level").textContent = `Lv.${user.level}`;
  document.getElementById("ach-xp").textContent = `${user.xp} XP`;
  document.getElementById("ach-rank-title").textContent = gamGetRankTitle(user.level);

  const nextLevelXp = gamXpForNextLevel(user.level);
  const xpBar = document.getElementById("ach-xp-bar");
  if (nextLevelXp == null) {
    xpBar.style.width = "100%";
  } else {
    const prevLevelXp = LEVEL_TABLE[user.level - 1] || 0;
    const ratio = (user.xp - prevLevelXp) / (nextLevelXp - prevLevelXp);
    xpBar.style.width = Math.max(0, Math.min(100, ratio * 100)) + "%";
  }

  const grid = document.getElementById("achievements-grid");
  grid.innerHTML = BADGE_DEFINITIONS.map((b) => {
    const earned = user.badges.includes(b.id);
    return `
      <div class="badge-tile dq-window ${earned ? "" : "locked"}">
        <div class="icon">${b.icon}</div>
        <div class="name">${b.name}</div>
      </div>
    `;
  }).join("");

  const titlesList = document.getElementById("achievements-titles-list");
  titlesList.innerHTML = RANK_TITLES.map((title, i) => {
    const levelStart = i * RANK_TITLE_LEVEL_STEP + 1;
    const levelEnd = levelStart + RANK_TITLE_LEVEL_STEP - 1;
    const reached = user.level >= levelStart;
    return `
      <div class="title-row dq-window ${reached ? "reached" : "locked"}">
        <div class="title-level">Lv.${levelStart}-${levelEnd}</div>
        <div class="title-name">${reached ? title : "？？？"}</div>
      </div>
    `;
  }).join("");

  renderAchievementsTabs();
}
