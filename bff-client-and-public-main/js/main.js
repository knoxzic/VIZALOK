/**
 * Shared UI: nav mobile, toast, checkout helpers, footer year
 */
window.BFF = window.BFF || {};

BFF.ui = (function () {
  function toast(message, ms = 3200) {
    let el = document.getElementById("bff-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "bff-toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), ms);
  }

  function initNav() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".site-nav__links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", () => {
      links.classList.toggle("is-open");
      toggle.setAttribute(
        "aria-expanded",
        links.classList.contains("is-open") ? "true" : "false"
      );
    });
    links.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => links.classList.remove("is-open"));
    });
  }

  function setYear() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  /**
   * Guided purchase entry — demo unlock or real Stripe link.
   */
  function startCheckout(productId) {
    const product = BFF.config?.products?.[productId];
    if (!product) {
      toast("Product not found");
      return;
    }

    if (BFF.storage.productUnlocked(productId)) {
      toast("Already unlocked — enjoy your access");
      return;
    }

    const demo = BFF.config.DEMO_MODE || !product.stripeUrl;
    openCheckoutModal(product, demo);
  }

  function openCheckoutModal(product, demo) {
    let overlay = document.getElementById("checkout-modal");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "checkout-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-labelledby="checkout-title">
        <p class="eyebrow" style="margin-bottom:0.5rem">Secure checkout</p>
        <h3 id="checkout-title">${escapeHtml(product.name)}</h3>
        <p>
          ${
            product.priceLabel ||
            (product.price ? "$" + product.price.toLocaleString() : "Included")
          }
          — ${escapeHtml(product.description || "")}
        </p>
        ${
          demo
            ? `<div class="demo-banner"><strong>Demo mode</strong><br/>Simulates payment success and unlocks access in this browser. Real Stripe opens when DEMO_MODE is off and a link is set.</div>`
            : `<div class="demo-banner"><strong>Stripe Checkout</strong><br/>You will complete payment on Stripe’s secure page.</div>`
        }
        <div class="modal__actions">
          <button type="button" class="btn btn--primary btn--block" data-action="confirm">
            ${demo ? "Simulate successful payment" : "Continue to Stripe"}
          </button>
          ${
            !demo && product.stripeUrl
              ? ""
              : demo && product.stripeUrl
                ? `<button type="button" class="btn btn--outline btn--block" data-action="stripe">Open real Stripe link instead</button>`
                : ""
          }
          <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const close = () => {
      overlay.classList.remove("is-open");
      setTimeout(() => overlay.remove(), 280);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener("click", close);
    overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      if (demo) {
        const result = BFF.storage.completePurchase(product.id, { mode: "demo" });
        close();
        if (result.ok) {
          toast("Payment simulated — access unlocked");
          const base = pathToSuccess();
          window.location.href =
            base +
            "?product=" +
            encodeURIComponent(product.id) +
            "&demo=1";
        }
      } else if (product.stripeUrl) {
        window.open(product.stripeUrl, "_blank", "noopener");
        close();
      }
    });
    const stripeBtn = overlay.querySelector('[data-action="stripe"]');
    if (stripeBtn) {
      stripeBtn.addEventListener("click", () => {
        window.open(product.stripeUrl, "_blank", "noopener");
        close();
      });
    }
  }

  function pathToSuccess() {
    // portals/* pages need ../success.html
    const inPortal = /\/portals\//i.test(location.pathname) || location.pathname.endsWith("\\portals\\") || location.href.includes("/portals/");
    const inPages = /\/pages\//i.test(location.pathname) || location.href.includes("/pages/");
    if (inPortal || inPages) return "../success.html";
    return "success.html";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function refreshUnlockUI() {
    document.querySelectorAll("[data-product]").forEach((el) => {
      const id = el.getAttribute("data-product");
      if (BFF.storage.productUnlocked(id)) {
        el.classList.add("is-unlocked");
        const btn = el.querySelector("[data-buy]");
        if (btn) {
          btn.textContent = "Unlocked — Open";
          btn.classList.remove("btn--primary", "btn--gold");
          btn.classList.add("btn--outline");
        }
        const badge = el.querySelector("[data-unlock-badge]");
        if (badge) {
          badge.hidden = false;
          badge.textContent = "Unlocked";
        }
      }
    });

    document.querySelectorAll("[data-requires-unlock]").forEach((el) => {
      const key = el.getAttribute("data-requires-unlock");
      const ok = BFF.storage.isUnlocked(key);
      el.hidden = !ok;
      el.classList.toggle("is-locked", !ok);
    });

    document.querySelectorAll("[data-show-if-locked]").forEach((el) => {
      const key = el.getAttribute("data-show-if-locked");
      el.hidden = BFF.storage.isUnlocked(key);
    });
  }

  function init() {
    initNav();
    setYear();
    refreshUnlockUI();
    window.addEventListener("bff:unlock", refreshUnlockUI);

    document.body.addEventListener("click", (e) => {
      const buy = e.target.closest("[data-buy]");
      if (buy) {
        e.preventDefault();
        startCheckout(buy.getAttribute("data-buy"));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { toast, startCheckout, refreshUnlockUI, escapeHtml };
})();
