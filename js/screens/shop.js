// ショップ（ガチャ）・コレクション画面

let shopCurrentTab = "shop";

function initShopScreen() {
  document.querySelectorAll("#shop-tabs .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      shopCurrentTab = chip.dataset.tab;
      document
        .querySelectorAll("#shop-tabs .filter-chip")
        .forEach((c) => c.classList.toggle("active", c === chip));
      renderShopTabs();
    });
  });

  document.getElementById("gacha-pull-single-btn").addEventListener("click", () => {
    const beforeCounts = Object.assign({}, App.user.itemCounts);
    const item = gamGachaPullSingle(App.user);
    if (!item) return;
    saveUserState(App.user);
    soundPlayBadge();
    renderShopScreen();
    renderGachaResult([item], beforeCounts);
  });

  document.getElementById("gacha-pull-ten-btn").addEventListener("click", () => {
    const beforeCounts = Object.assign({}, App.user.itemCounts);
    const items = gamGachaPullTen(App.user);
    if (!items) return;
    saveUserState(App.user);
    soundPlayBadge();
    renderShopScreen();
    renderGachaResult(items, beforeCounts);
  });
}

function renderShopTabs() {
  ["shop", "collection"].forEach((tab) => {
    document.getElementById("shop-tab-" + tab).style.display = tab === shopCurrentTab ? "" : "none";
  });
}

function renderGachaResult(items, beforeCounts) {
  const resultEl = document.getElementById("gacha-result");
  resultEl.innerHTML = `
    <div class="gacha-result-grid">
      ${items
        .map((item) => {
          const isNew = !beforeCounts[item.id];
          return `
            <div class="gacha-result-tile rarity-${item.rarity}">
              ${isNew ? '<div class="gacha-new-badge">NEW</div>' : ""}
              <div class="icon">${item.icon}</div>
              <div class="name">${item.name}</div>
              <div class="rarity-label">${ITEM_RARITY_LABEL[item.rarity]}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderShopScreen() {
  const user = App.user;
  const gold = user.gold || 0;
  const itemCounts = user.itemCounts || {};

  document.getElementById("shop-gold-balance").textContent = `${gold} 🪙`;

  document.getElementById("gacha-pull-single-btn").disabled = gold < GACHA_SINGLE_COST;
  document.getElementById("gacha-pull-ten-btn").disabled = gold < GACHA_TEN_COST;

  document.getElementById("gacha-rate-table").innerHTML = ["common", "rare", "epic"]
    .map((rarity) => {
      const items = ITEM_DEFINITIONS.filter((i) => i.rarity === rarity);
      const perItemRate = gamItemDropRatePercent(items[0]);
      const totalRate = perItemRate * items.length;
      return `
        <div class="gacha-rate-row">
          <div class="gacha-rate-header">
            <span class="shop-item-rarity rarity-${rarity}">${ITEM_RARITY_LABEL[rarity]}</span>
            <span class="gacha-rate-percent">1つあたり${perItemRate.toFixed(1)}%（合計${totalRate.toFixed(1)}%）</span>
          </div>
          <div class="gacha-rate-names">${items.map((i) => i.name).join("、")}</div>
        </div>
      `;
    })
    .join("");

  const ownedCount = Object.keys(itemCounts).filter((id) => itemCounts[id] > 0).length;
  document.getElementById("shop-collection-summary").innerHTML =
    `<div class="collection-summary">コレクション ${ownedCount} / ${ITEM_DEFINITIONS.length}</div>`;

  document.getElementById("shop-collection-grid").innerHTML = ITEM_DEFINITIONS.map((item) => {
    const count = itemCounts[item.id] || 0;
    const owned = count > 0;
    return `
      <div class="badge-tile item-tile ${owned ? "" : "locked"}">
        <div class="icon">${owned ? item.icon : "？"}</div>
        <div class="name">${owned ? item.name : "？？？"}</div>
        ${owned ? `<div class="item-count">×${count}</div>` : ""}
        ${owned ? `<div class="item-desc">${item.desc}</div>` : ""}
      </div>
    `;
  }).join("");

  renderShopTabs();
}
