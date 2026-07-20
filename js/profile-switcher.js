// 学習者（プロフィール）切り替えオーバーレイ

function initProfileSwitcher() {
  document.getElementById("home-profile-btn").addEventListener("click", () => {
    renderProfileList();
    document.getElementById("profile-switcher-overlay").classList.add("active");
  });
  document.getElementById("profile-close-btn").addEventListener("click", closeProfileSwitcher);
  document.getElementById("profile-switcher-overlay").addEventListener("click", (e) => {
    if (e.target.id === "profile-switcher-overlay") closeProfileSwitcher();
  });
  document.getElementById("profile-add-btn").addEventListener("click", () => {
    const name = prompt("新しい学習者の名前を入力してください");
    if (!name || !name.trim()) return;
    createProfile(name.trim());
    afterProfileChange();
  });
}

function closeProfileSwitcher() {
  document.getElementById("profile-switcher-overlay").classList.remove("active");
}

function afterProfileChange() {
  App.progress = loadProgress();
  App.user = loadUserState();
  App.session = null;
  closeProfileSwitcher();
  window.location.hash = "#home";
  showScreen("home");
}

function renderProfileList() {
  const state = loadProfilesState();
  const listEl = document.getElementById("profile-list");
  listEl.innerHTML = "";

  state.list.forEach((p) => {
    const row = document.createElement("div");
    row.className = "profile-row" + (p.id === state.currentId ? " current" : "");

    const selectBtn = document.createElement("button");
    selectBtn.className = "profile-select-btn";
    selectBtn.textContent = (p.id === state.currentId ? "▶ " : "") + p.name;
    selectBtn.addEventListener("click", () => {
      if (p.id !== state.currentId) {
        switchProfile(p.id);
        afterProfileChange();
      } else {
        closeProfileSwitcher();
      }
    });
    row.appendChild(selectBtn);

    const renameBtn = document.createElement("button");
    renameBtn.className = "profile-icon-btn";
    renameBtn.title = "名前を変更";
    renameBtn.textContent = "✏️";
    renameBtn.addEventListener("click", () => {
      const newName = prompt("新しい名前を入力してください", p.name);
      if (!newName || !newName.trim()) return;
      renameProfile(p.id, newName.trim());
      renderProfileList();
      if (p.id === state.currentId) renderHomeScreen();
    });
    row.appendChild(renameBtn);

    if (state.list.length > 1) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "profile-icon-btn";
      deleteBtn.title = "削除";
      deleteBtn.textContent = "🗑️";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`学習者「${p.name}」の学習データを削除します。よろしいですか？`)) return;
        const wasCurrent = p.id === state.currentId;
        deleteProfile(p.id);
        if (wasCurrent) {
          afterProfileChange();
        } else {
          renderProfileList();
        }
      });
      row.appendChild(deleteBtn);
    }

    listEl.appendChild(row);
  });
}
