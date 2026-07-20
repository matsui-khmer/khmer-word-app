// 単語の発音音声（audio/配下の各単語IDに対応するmp3ファイル）の再生

// gTTSが子音クラスター・母音を正しく読み上げられなかった単語は、
// クメール語講師本人による録音音声に差し替え済み（2026-07-20時点で全件解消）
const AUDIO_UNAVAILABLE_WORD_IDS = new Set([]);

function hasWordAudio(wordId) {
  return !AUDIO_UNAVAILABLE_WORD_IDS.has(wordId);
}

let _wordAudioEl = null;

function playWordAudio(wordId) {
  if (_wordAudioEl) {
    _wordAudioEl.pause();
  }
  _wordAudioEl = new Audio(`audio/${wordId}.mp3`);
  _wordAudioEl.play().catch(() => {});
}
