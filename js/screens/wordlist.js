// 単語一覧・図鑑画面

let wordlistCurrentFilter = "all";

function initWordlistScreen() {
  document.querySelectorAll("#wordlist-filters .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      wordlistCurrentFilter = chip.dataset.filter;
      document
        .querySelectorAll("#wordlist-filters .filter-chip")
        .forEach((c) => c.classList.toggle("active", c === chip));
      renderWordlistScreen();
    });
  });
}

function wordMatchesFilter(word, record, filter) {
  if (filter === "core70") return word.isCore70;
  if (filter.indexOf("rank") === 0) {
    return srsComprehensionRank(record) === Number(filter.slice(4));
  }
  return true; // "all"
}

function renderWordlistScreen() {
  const container = document.getElementById("wordlist-content");
  const grouped = {};

  App.words.forEach((word) => {
    const record = App.progress[word.id];
    if (!wordMatchesFilter(word, record, wordlistCurrentFilter)) return;
    if (!grouped[word.category]) grouped[word.category] = [];
    grouped[word.category].push({ word, record });
  });

  const categories = Object.keys(grouped).sort(
    (a, b) => KHMER_CATEGORY_ORDER[a] - KHMER_CATEGORY_ORDER[b]
  );

  if (categories.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; color:var(--ink-soft);">該当する単語がありません</div>`;
    return;
  }

  container.innerHTML = categories
    .map((cat) => {
      const items = grouped[cat];
      const tiles = items
        .map(({ word, record }) => {
          const rank = srsComprehensionRank(record);
          const rankMeta = SRS_COMPREHENSION_RANK_META[rank];
          const readingHtml = word.reading
            ? `<div class="reading-tag">${readingWithIpaHtml(word)}</div>`
            : "";
          const audioBtnHtml = hasWordAudio(word.id)
            ? `<button class="audio-btn small" data-audio="${word.id}" aria-label="発音を聞く">🔊</button>`
            : "";
          return `
            <div class="word-tile dq-window rank-${rank}">
              <div class="rank-icon" title="${rankMeta.label}">${rankMeta.icon}</div>
              <div class="km-row">
                <div class="km khmer">${word.khmer}</div>
                ${audioBtnHtml}
              </div>
              ${readingHtml}
              <div class="jp">${word.meaning}</div>
              ${word.isCore70 ? '<div class="core70-tag">70選</div>' : ""}
            </div>
          `;
        })
        .join("");
      return `
        <div class="category-block">
          <div class="category-title">【${cat}】 ${items.length}語</div>
          <div class="word-grid">${tiles}</div>
        </div>
      `;
    })
    .join("");
}
