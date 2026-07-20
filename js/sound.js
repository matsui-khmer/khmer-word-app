// Web Audio APIでその場に音を生成するSE（外部音声ファイル不要）

let _audioCtx = null;

function _soundGetContext() {
  if (!_audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
  }
  if (_audioCtx.state === "suspended") {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

function _soundEnabled() {
  return !App.user || App.user.settings.soundEnabled !== false;
}

// note: { freq, start, duration, type, gain }
function _soundPlayNotes(notes) {
  if (!_soundEnabled()) return;
  const ctx = _soundGetContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  notes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = note.type || "sine";
    osc.frequency.value = note.freq;

    const startAt = now + (note.start || 0);
    const duration = note.duration || 0.15;
    const peakGain = note.gain != null ? note.gain : 0.15;

    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  });
}

function soundPlayClick() {
  _soundPlayNotes([{ freq: 720, duration: 0.06, gain: 0.08, type: "sine" }]);
}

function soundPlayCorrect() {
  _soundPlayNotes([
    { freq: 523.25, start: 0, duration: 0.12, gain: 0.14, type: "sine" },
    { freq: 783.99, start: 0.08, duration: 0.18, gain: 0.14, type: "sine" },
  ]);
}

function soundPlayIncorrect() {
  _soundPlayNotes([
    { freq: 220, start: 0, duration: 0.18, gain: 0.12, type: "sawtooth" },
    { freq: 174.61, start: 0.1, duration: 0.2, gain: 0.1, type: "sawtooth" },
  ]);
}

function soundPlayLevelUp() {
  _soundPlayNotes([
    { freq: 523.25, start: 0, duration: 0.14, gain: 0.15, type: "triangle" },
    { freq: 659.25, start: 0.1, duration: 0.14, gain: 0.15, type: "triangle" },
    { freq: 783.99, start: 0.2, duration: 0.14, gain: 0.15, type: "triangle" },
    { freq: 1046.5, start: 0.3, duration: 0.35, gain: 0.16, type: "triangle" },
  ]);
}

function soundPlayBadge() {
  _soundPlayNotes([
    { freq: 880, start: 0, duration: 0.1, gain: 0.13, type: "sine" },
    { freq: 1108.7, start: 0.09, duration: 0.22, gain: 0.13, type: "sine" },
  ]);
}

// セッション完走時の爽快なファンファーレ（結果画面表示時）
function soundPlaySessionComplete() {
  _soundPlayNotes([
    { freq: 523.25, start: 0, duration: 0.11, gain: 0.14, type: "triangle" },
    { freq: 659.25, start: 0.09, duration: 0.11, gain: 0.14, type: "triangle" },
    { freq: 783.99, start: 0.18, duration: 0.11, gain: 0.14, type: "triangle" },
    { freq: 1046.5, start: 0.27, duration: 0.11, gain: 0.15, type: "triangle" },
    { freq: 1318.5, start: 0.36, duration: 0.4, gain: 0.17, type: "triangle" },
  ]);
}
