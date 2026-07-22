/**
 * Software portal product rendering
 */
window.BFF = window.BFF || {};

BFF.software = (function () {
  const SOFTWARE_IDS = [
    "diy_starter",
    "funding_readiness",
    "childcare_accelerator",
    "grant_writing",
    "first_two_grants",
  ];

  function render() {
    const root = document.getElementById("product-grid");
    if (!root || !BFF.config) return;

    root.innerHTML = SOFTWARE_IDS.map((id) => {
      const p = BFF.config.products[id];
      if (!p) return "";
      const unlocked = BFF.storage.productUnlocked(id);
      const price =
        p.priceLabel || (p.price != null ? "$" + p.price.toLocaleString() : "");
      return `
        <article class="product-card ${unlocked ? "is-unlocked" : ""}" data-product="${p.id}">
          <div class="product-card__top">
            <div>
              ${p.popular ? '<span class="badge badge--rose">Most popular</span>' : ""}
              <h3 class="product-card__title" style="margin-top:0.5rem">${BFF.ui.escapeHtml(p.name)}</h3>
            </div>
            <div class="product-card__price">${price}</div>
          </div>
          <div class="product-card__body">
            <span class="badge badge--unlock" data-unlock-badge ${unlocked ? "" : "hidden"}>Unlocked</span>
            <p>${BFF.ui.escapeHtml(p.description)}</p>
            <ul class="product-card__list">
              ${(p.benefits || []).map((b) => `<li>${BFF.ui.escapeHtml(b)}</li>`).join("")}
            </ul>
            <button type="button" class="btn ${unlocked ? "btn--outline" : p.popular ? "btn--gold" : "btn--primary"} btn--block" data-buy="${p.id}">
              ${unlocked ? "Unlocked — Open" : "Purchase easily"}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function init() {
    render();
    BFF.ui?.refreshUnlockUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { render };
})();
