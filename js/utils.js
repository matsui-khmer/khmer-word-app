// 日付・配列操作の共通ヘルパー（DOM非依存）

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// isoDate2 - isoDate1 の日数差（isoDate2が未来なら正の値）
function diffDaysISO(isoDate1, isoDate2) {
  const d1 = new Date(isoDate1 + "T00:00:00");
  const d2 = new Date(isoDate2 + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

function formatStudyMinutes(totalMinutes) {
  const m = Math.floor(totalMinutes || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}時間${m % 60}分` : `${m % 60}分`;
}

// カタカナ読み＋（あれば）発音記号(IPA)をまとめて表示するためのHTML断片を作る
function readingWithIpaHtml(word) {
  if (!word.reading) return "";
  const ipaHtml = word.ipa ? ` <span class="ipa-tag">[${word.ipa}]</span>` : "";
  return `${word.reading}${ipaHtml}`;
}
