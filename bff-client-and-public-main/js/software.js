/**
 * Software portal — live Stripe products first, then coming soon.
 * Never marks Purchased from localStorage; refreshUnlockUI verifies via Supabase.
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

  function isLive(p) {
    return Boolean(p && p.stripeUrl && !p.inactive && !p.comingSoon);
  }

  function cardHtml(p) {
    const price =
      p.priceLabel || (p.price != null ? "$" + p.price.toLocaleString() : "");
    const live = isLive(p);
    return `
        <article class="product-card" data-product="${p.id}">
          <div class="product-card__top">
            <div>
              ${p.popular ? '<span class="badge badge--rose">Most popular</span>' : ""}
              ${!live ? '<span class="badge" style="margin-left:0.35rem">Coming soon</span>' : ""}
              <h3 class="product-card__title" style="margin-top:0.5rem">${BFF.ui.escapeHtml(p.name)}</h3>
            </div>
            <div class="product-card__price">${price}</div>
          </div>
          <div class="product-card__body">
            <span class="badge badge--unlock" data-unlock-badge hidden>Purchased</span>
            <p>${BFF.ui.escapeHtml(p.description)}</p>
            <ul class="product-card__list">
              ${(p.benefits || []).map((b) => `<li>${BFF.ui.escapeHtml(b)}</li>`).join("")}
            </ul>
            <button type="button" class="btn ${p.popular && live ? "btn--gold" : live ? "btn--primary" : "btn--outline"} btn--block" data-buy="${p.id}">
              ${live ? "Buy with Stripe" : "Coming soon"}
            </button>
          </div>
        </article>
      `;
  }

  function render() {
    const root = document.getElementById("product-grid");
    if (!root || !BFF.config) return;

    const products = SOFTWARE_IDS.map((id) => BFF.config.products[id]).filter(Boolean);
    products.sort((a, b) => Number(isLive(b)) - Number(isLive(a)));

    // Always render as not purchased; refreshUnlockUI applies real entitlements after sign-in check
    root.innerHTML = products.map((p) => cardHtml(p)).join("");
  }

  function init() {
    render();
    if (BFF.ui && BFF.ui.refreshUnlockUI) BFF.ui.refreshUnlockUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { render };
})();
