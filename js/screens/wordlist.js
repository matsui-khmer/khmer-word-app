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

// 理解度ランクの内訳と、よく間違えている単語（つまずきポイント）を表示する
function renderWordlistStats() {
  const container = document.getElementById("wordlist-stats");
  if (!container) return;

  const rankCounts = [0, 0, 0, 0, 0, 0]; // index 1-5を使用
  const weakWords = [];

  App.words.forEach((word) => {
    const record = App.progress[word.id];
    const rank = srsComprehensionRank(record);
    rankCounts[rank]++;
    const incorrect = record ? record.incorrectCount || 0 : 0;
    if (incorrect > 0) {
      weakWords.push({ word, incorrect, correct: record.correctCount || 0 });
    }
  });

  weakWords.sort((a, b) => b.incorrect - a.incorrect);
  const top = weakWords.slice(0, 8);

  const rankSummaryHtml = SRS_COMPREHENSION_RANK_META.slice(1)
    .map(
      (meta) => `
        <div class="stats-rank-item">
          <span class="stats-rank-icon">${meta.icon}</span>
          <span class="stats-rank-count">${rankCounts[meta.rank]}</span>
          <span class="stats-rank-label">${meta.label}</span>
        </div>
      `
    )
    .join("");

  const weakListHtml = top.length
    ? top
        .map(({ word, incorrect, correct }) => {
          const total = incorrect + correct;
          const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
          const readingHtml = word.reading
            ? `<span class="reading-tag small">${readingWithIpaHtml(word)}</span>`
            : "";
          return `
            <div class="weak-word-row">
              <span class="km khmer">${word.khmer}</span>
              ${readingHtml}
              <span class="jp">${word.meaning}</span>
              <span class="weak-word-stat">${incorrect}回間違い・正答率${accuracy}%</span>
            </div>
          `;
        })
        .join("")
    : `<div style="text-align:center; color:var(--ink-soft); padding:8px 0;">まだ間違えた単語はありません</div>`;

  container.innerHTML = `
    <div class="card">
      <div class="card-label-row">つまずきポイント</div>
      <div class="stats-rank-row">${rankSummaryHtml}</div>
      ${top.length ? `<div class="stats-weak-title">よく間違える単語 TOP${top.length}</div>` : ""}
      <div class="weak-word-list">${weakListHtml}</div>
    </div>
  `;
}

let wordlistSectionObserver = null;

function renderWordlistScreen() {
  renderWordlistStats();
  const container = document.getElementById("wordlist-content");
  const railContainer = document.getElementById("wordlist-index-rail");
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
    railContainer.innerHTML = "";
    return;
  }

  container.innerHTML = categories
    .map((cat) => {
      const items = grouped[cat];
      const rows = items
        .map(({ word, record }) => {
          const rank = srsComprehensionRank(record);
          const rankMeta = SRS_COMPREHENSION_RANK_META[rank];
          const readingHtml = word.reading
            ? `<span class="row-reading">${readingWithIpaHtml(word)}</span>`
            : "";
          const audioBtnHtml = hasWordAudio(word.id)
            ? `<button class="audio-btn small" data-audio="${word.id}" aria-label="発音を聞く">🔊</button>`
            : "";
          return `
            <div class="wordlist-row rank-${rank}">
              <div class="wordlist-row-main">
                <span class="row-rank-icon" title="${rankMeta.label}">${rankMeta.icon}</span>
                <span class="row-khmer khmer">${word.khmer}</span>
                ${readingHtml}
                ${audioBtnHtml}
                ${word.isCore70 ? '<span class="row-core70" title="超重要70選">70選</span>' : ""}
              </div>
              <div class="wordlist-row-meaning">${word.meaning}</div>
            </div>
          `;
        })
        .join("");
      return `
        <div class="wordlist-cat-section" data-cat="${cat}">
          <div class="wordlist-cat-header" data-cat="${cat}">【${cat}】 ${items.length}語</div>
          ${rows}
        </div>
      `;
    })
    .join("");

  railContainer.innerHTML = categories
    .map((cat) => `<button data-cat="${cat}" class="khmer">${cat}</button>`)
    .join("");

  function jumpToCategory(cat) {
    // sticky状態の見出し自体ではなく、通常配置のセクション枠を基準にスクロールする
    // （見出しは自分のセクション末尾に貼り付いた位置に残っていることがあり、
    // それを基準にすると本来の先頭ではなくセクションの終わり際に着地してしまうため）
    const section = container.querySelector(`.wordlist-cat-section[data-cat="${cat}"]`);
    if (section) section.scrollIntoView({ block: "start" });
  }

  const railButtons = Array.from(railContainer.querySelectorAll("button"));
  railButtons.forEach((btn) => {
    btn.addEventListener("click", () => jumpToCategory(btn.dataset.cat));
  });

  // 指をレール上で滑らせている間、通過した文字へ連続してジャンプできるようにする
  // （iOSの連絡先アプリの索引と同じ「なぞって移動」操作）
  let railDragging = false;
  function railButtonAtPoint(x, y) {
    return railButtons.find((btn) => {
      const r = btn.getBoundingClientRect();
      return y >= r.top && y <= r.bottom && x >= r.left && x <= r.right;
    });
  }
  function handleRailPointer(clientX, clientY) {
    const btn = railButtonAtPoint(clientX, clientY);
    if (!btn) return;
    railTip.textContent = btn.dataset.cat;
    railTip.style.display = "flex";
    const railRect = railContainer.getBoundingClientRect();
    railTip.style.top = (btn.getBoundingClientRect().top - railRect.top) + "px";
    jumpToCategory(btn.dataset.cat);
  }
  const railTip = document.createElement("div");
  railTip.className = "wordlist-rail-tip khmer";
  railContainer.appendChild(railTip);

  railContainer.addEventListener("pointerdown", (e) => {
    railDragging = true;
    railContainer.setPointerCapture(e.pointerId);
    handleRailPointer(e.clientX, e.clientY);
  });
  railContainer.addEventListener("pointermove", (e) => {
    if (!railDragging) return;
    handleRailPointer(e.clientX, e.clientY);
  });
  railContainer.addEventListener("pointerup", () => {
    railDragging = false;
    railTip.style.display = "none";
  });
  railContainer.addEventListener("pointercancel", () => {
    railDragging = false;
    railTip.style.display = "none";
  });

  if (wordlistSectionObserver) wordlistSectionObserver.disconnect();
  wordlistSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const cat = entry.target.dataset.cat;
        railContainer.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
      });
    },
    { rootMargin: "0px 0px -80% 0px" }
  );
  container.querySelectorAll(".wordlist-cat-header").forEach((header) => wordlistSectionObserver.observe(header));
}
