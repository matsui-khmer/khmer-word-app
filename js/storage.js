// localStorage読み書きラッパー（学習者プロフィールごとに名前空間を分ける）

const STORAGE_KEYS = {
  profiles: "kw_v1_profiles",
  progressPrefix: "kw_v1_progress_",
  userPrefix: "kw_v1_user_",
  legacyProgress: "kw_v1_progress",
  legacyUser: "kw_v1_user",
};

const DEFAULT_USER_STATE = {
  xp: 0,
  level: 1,
  streakDays: 0,
  totalStudyDays: 0,
  totalStudyMinutes: 0,
  totalAnsweredCount: 0,
  longestCombo: 0,
  lastStudyDate: null,
  badges: [],
  totalSessionsCompleted: 0,
  dailyProgress: { date: null, count: 0 },
  gold: 0,
  itemCounts: {},
  hasSeenTutorial: false,
  settings: {
    showReading: true,
    enableJpToKm: true,
    soundEnabled: true,
    quizScope: "all",
    sessionSize: 20,
    dailyGoal: 20,
  },
};

// ---------- 学習者プロフィール管理 ----------

function loadProfilesState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profiles);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // フォールスルーして初回起動時と同じ処理にする
  }

  // 初回起動、またはプロフィール機能導入前のバージョンからの移行:
  // 「学習者1」を作成し、旧バージョンのデータがあればそのまま引き継ぐ
  const firstId = "p1";
  const legacyProgress = localStorage.getItem(STORAGE_KEYS.legacyProgress);
  const legacyUser = localStorage.getItem(STORAGE_KEYS.legacyUser);
  if (legacyProgress) localStorage.setItem(STORAGE_KEYS.progressPrefix + firstId, legacyProgress);
  if (legacyUser) localStorage.setItem(STORAGE_KEYS.userPrefix + firstId, legacyUser);

  const initial = { currentId: firstId, list: [{ id: firstId, name: "学習者1" }] };
  saveProfilesState(initial);
  return initial;
}

function saveProfilesState(state) {
  localStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(state));
}

function getCurrentProfileId() {
  return loadProfilesState().currentId;
}

function getCurrentProfile() {
  const state = loadProfilesState();
  return state.list.find((p) => p.id === state.currentId) || state.list[0];
}

function createProfile(name) {
  const state = loadProfilesState();
  const id = "p" + Date.now();
  state.list.push({ id, name });
  state.currentId = id;
  saveProfilesState(state);
  return id;
}

function switchProfile(id) {
  const state = loadProfilesState();
  if (!state.list.some((p) => p.id === id)) return;
  state.currentId = id;
  saveProfilesState(state);
}

function renameProfile(id, name) {
  const state = loadProfilesState();
  const p = state.list.find((p) => p.id === id);
  if (p) p.name = name;
  saveProfilesState(state);
}

function deleteProfile(id) {
  const state = loadProfilesState();
  if (state.list.length <= 1) return; // 学習者は最低1人残す
  state.list = state.list.filter((p) => p.id !== id);
  if (state.currentId === id) state.currentId = state.list[0].id;
  saveProfilesState(state);
  localStorage.removeItem(STORAGE_KEYS.progressPrefix + id);
  localStorage.removeItem(STORAGE_KEYS.userPrefix + id);
}

// ---------- 学習データ（現在の学習者のものを読み書き） ----------

function loadProgress() {
  const id = getCurrentProfileId();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progressPrefix + id);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  const id = getCurrentProfileId();
  localStorage.setItem(STORAGE_KEYS.progressPrefix + id, JSON.stringify(progress));
}

function loadUserState() {
  const id = getCurrentProfileId();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.userPrefix + id);
    if (!raw) return structuredCloneUserState();
    const parsed = JSON.parse(raw);
    const merged = Object.assign(structuredCloneUserState(), parsed, {
      settings: Object.assign({}, DEFAULT_USER_STATE.settings, parsed.settings),
    });
    // totalStudyDaysは後から追加した項目のため、それ以前からのデータでは
    // 「連続日数はあるのに累計日数が0のまま」になりうる。連続日数を下限として補正する
    if ((merged.totalStudyDays || 0) < (merged.streakDays || 0)) {
      merged.totalStudyDays = merged.streakDays;
    }
    return merged;
  } catch (e) {
    return structuredCloneUserState();
  }
}

function saveUserState(state) {
  const id = getCurrentProfileId();
  localStorage.setItem(STORAGE_KEYS.userPrefix + id, JSON.stringify(state));
}

function structuredCloneUserState() {
  return JSON.parse(JSON.stringify(DEFAULT_USER_STATE));
}

function resetAllData() {
  const id = getCurrentProfileId();
  localStorage.removeItem(STORAGE_KEYS.progressPrefix + id);
  localStorage.removeItem(STORAGE_KEYS.userPrefix + id);
}
