// 実用フレーズ集画面

function renderPhrasesScreen() {
  const container = document.getElementById("phrases-content");
  if (!container) return;

  container.innerHTML = PHRASE_CATEGORIES.map((cat) => {
    const phrasesHtml = cat.phrases
      .map(
        (p) => `
        <div class="phrase-card">
          <div class="phrase-meaning">${p.meaning}</div>
          <div class="phrase-khmer">${p.khmer}</div>
          <div class="phrase-reading">（${p.reading}）</div>
        </div>
      `
      )
      .join("");

    return `
      <div class="category-block">
        <div class="category-title">${cat.icon} ${cat.title}</div>
        <p class="phrase-intro">${cat.intro}</p>
        ${phrasesHtml}
      </div>
    `;
  }).join("");
}
