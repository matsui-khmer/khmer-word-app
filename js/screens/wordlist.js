// 単語一覧・図鑑画面

let wordlistCurrentFilter = "all";
// カテゴリーごとの開閉状態（アコーディオン）。フィルター切り替えや再描画をまたいでも
// ユーザーが開いたカテゴリーは開いたままにしたいので、モジュールレベルで保持する
let wordlistExpandedCats = new Set();

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

  document.getElementById("wordlist-content").addEventListener("click", (e) => {
    const header = e.target.closest(".wordlist-cat-header");
    if (!header) return;
    const section = header.closest(".wordlist-cat-section");
    const cat = header.dataset.cat;
    const nowOpen = section.classList.toggle("open");
    if (nowOpen) wordlistExpandedCats.add(cat);
    else wordlistExpandedCats.delete(cat);
  });

  document.getElementById("wordlist-index-toggle").addEventListener("click", () => {
    toggleWordlistIndexRail();
  });
  document.getElementById("wordlist-index-backdrop").addEventListener("click", () => {
    toggleWordlistIndexRail(false);
  });

  // レール本体へのイベント配線は再描画のたびにボタンが作り直されても壊れないよう、
  // ここで一度だけ行う（対象のボタンはクリック時に都度DOMから探す）
  const railContainer = document.getElementById("wordlist-index-rail");
  const railTip = document.createElement("div");
  railTip.className = "wordlist-rail-tip khmer";
  railContainer.appendChild(railTip);

  let railDragging = false;
  function railButtonAtPoint(x, y) {
    return Array.from(railContainer.querySelectorAll("button")).find((btn) => {
      const r = btn.getBoundingClientRect();
      return y >= r.top && y <= r.bottom && x >= r.left && x <= r.right;
    });
  }
  function handleRailPointer(clientX, clientY) {
    const btn = railButtonAtPoint(clientX, clientY);
    if (!btn) return;
    railTip.textContent = wordlistRailLabel(btn.dataset.cat);
    railTip.style.display = "flex";
    const railRect = railContainer.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    railTip.style.left = (btnRect.left + btnRect.width / 2 - railRect.left) + "px";
    railTip.style.top = (btnRect.top - railRect.top) + "px";
    jumpToWordlistCategory(btn.dataset.cat);
  }
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
    toggleWordlistIndexRail(false);
  });
  railContainer.addEventListener("pointercancel", () => {
    railDragging = false;
    railTip.style.display = "none";
  });
}

// 「独立体母音字」は子音1文字とは違い長い文字列なので、レール上だけ短縮表示する
function wordlistRailLabel(cat) {
  return cat === "独立体母音字" ? "母" : cat;
}

function jumpToWordlistCategory(cat) {
  // sticky状態の見出し自体ではなく、通常配置のセクション枠を基準にスクロールする
  // （見出しは自分のセクション末尾に貼り付いた位置に残っていることがあり、
  // それを基準にすると本来の先頭ではなくセクションの終わり際に着地してしまうため）
  const section = document.querySelector(`#wordlist-content .wordlist-cat-section[data-cat="${cat}"]`);
  if (!section) return;
  // 索引レールから跳んだ先は中身を見たいはずなので、閉じていたら開いてからスクロールする
  if (!section.classList.contains("open")) {
    section.classList.add("open");
    wordlistExpandedCats.add(cat);
  }
  section.scrollIntoView({ block: "start" });
}

function toggleWordlistIndexRail(forceOpen) {
  const rail = document.getElementById("wordlist-index-rail");
  const toggleBtn = document.getElementById("wordlist-index-toggle");
  const backdrop = document.getElementById("wordlist-index-backdrop");
  const open = forceOpen !== undefined ? forceOpen : !rail.classList.contains("open");
  rail.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
  toggleBtn.classList.toggle("active", open);
  toggleBtn.setAttribute("aria-label", open ? "索引を閉じる" : "索引を開く");
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
    document.getElementById("wordlist-index-grid-main").innerHTML = "";
    document.getElementById("wordlist-index-grid-tail").innerHTML = "";
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
      const isOpen = wordlistExpandedCats.has(cat);
      return `
        <div class="wordlist-cat-section${isOpen ? " open" : ""}" data-cat="${cat}">
          <button type="button" class="wordlist-cat-header" data-cat="${cat}">
            <span>【${cat}】 ${items.length}語</span>
            <span class="accordion-arrow">▶</span>
          </button>
          <div class="wordlist-cat-body">${rows}</div>
        </div>
      `;
    })
    .join("");

  // クメール語の子音表と同じ「横5文字」の並びを再現する: 先頭25個は5列×5行、
  // 残りは4列で（データ数が33に満たない場合は最終行が4個未満になる）
  const railBtnHtml = (cat) => `<button data-cat="${cat}" class="khmer">${wordlistRailLabel(cat)}</button>`;
  const gridMain = document.getElementById("wordlist-index-grid-main");
  const gridTail = document.getElementById("wordlist-index-grid-tail");
  gridMain.innerHTML = categories.slice(0, 25).map(railBtnHtml).join("");
  gridTail.innerHTML = categories.slice(25).map(railBtnHtml).join("");

  railContainer.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      jumpToWordlistCategory(btn.dataset.cat);
      toggleWordlistIndexRail(false);
    });
  });

  const toggleBtn = document.getElementById("wordlist-index-toggle");
  if (wordlistSectionObserver) wordlistSectionObserver.disconnect();
  wordlistSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const cat = entry.target.dataset.cat;
        railContainer.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
        if (!railContainer.classList.contains("open")) toggleBtn.textContent = wordlistRailLabel(cat);
      });
    },
    { rootMargin: "0px 0px -80% 0px" }
  );
  container.querySelectorAll(".wordlist-cat-header").forEach((header) => wordlistSectionObserver.observe(header));
}
