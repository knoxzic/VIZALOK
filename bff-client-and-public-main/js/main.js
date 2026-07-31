/**
 * Shared UI: nav mobile, toast, real Stripe checkout, footer year
 * No simulated payments — production only.
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

  function contactPath(productId) {
    const q = productId ? "?product=" + encodeURIComponent(productId) : "";
    if (
      location.pathname.includes("/pages/") ||
      location.pathname.includes("/portals/") ||
      location.pathname.includes("/expense-iq/")
    ) {
      return "../pages/contact.html" + q;
    }
    return "pages/contact.html" + q;
  }

  /**
   * Stripe Payment Link + client_reference_id for webhook → profile mapping.
   * Format: {userId}|{productKey}
   */
  async function stripeCheckoutUrl(product) {
    let url = product.stripeUrl;
    if (!url) return "";
    try {
      let userId = "";
      let email = "";
      if (BFF.auth && BFF.auth.getUser) {
        const { user } = await BFF.auth.getUser();
        if (user && user.id) userId = user.id;
        if (user && user.email) email = user.email;
      }
      const u = new URL(url);
      if (userId) {
        u.searchParams.set("client_reference_id", userId + "|" + product.id);
      }
      if (email) u.searchParams.set("prefilled_email", email);
      return u.toString();
    } catch {
      return url;
    }
  }

  function resolveProduct(productId) {
    let product = BFF.config?.products?.[productId];
    if (!product && BFF.config?.PAYWALL?.products?.[productId]) {
      const p = BFF.config.PAYWALL.products[productId];
      product = {
        id: productId,
        name: p.name,
        stripeUrl: p.stripeUrl,
        priceLabel: p.priceLabel,
        description: p.name,
        comingSoon: p.comingSoon,
        inactive: false,
      };
    }
    return product;
  }

  async function startCheckout(productId) {
    const product = resolveProduct(productId);
    if (!product) {
      toast("Product not found");
      return;
    }

    if (product.inactive) {
      toast("This package is temporarily unavailable. Contact us to purchase.");
      return;
    }

    if (!product.stripeUrl || product.comingSoon) {
      toast("Coming soon — request access via Contact.");
      window.location.href = contactPath(productId);
      return;
    }

    const href = await stripeCheckoutUrl(product);
    window.open(href, "_blank", "noopener");
    toast("Opening secure Stripe checkout…");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refreshUnlockUI() {
    // Prefer Supabase entitlements when signed in
    let entitledKeys = new Set();
    try {
      if (BFF.auth && BFF.access) {
        const { user } = await BFF.auth.getUser();
        if (user) {
          const rows = await BFF.access.listSubscriptions(user.id);
          rows.forEach((r) => {
            if (BFF.access.isEntitlementActive(r)) entitledKeys.add(r.product_key);
          });
        }
      }
    } catch (_) {}

    document.querySelectorAll("[data-product]").forEach((el) => {
      const id = el.getAttribute("data-product");
      const unlocked =
        entitledKeys.has(id) ||
        entitledKeys.has("full_suite") ||
        (BFF.storage && BFF.storage.productUnlocked && BFF.storage.productUnlocked(id));
      if (unlocked) {
        el.classList.add("is-unlocked");
        const btn = el.querySelector("[data-buy]");
        if (btn) {
          btn.textContent = "Purchased";
          btn.classList.remove("btn--primary", "btn--gold");
          btn.classList.add("btn--outline");
          btn.disabled = true;
        }
        const badge = el.querySelector("[data-unlock-badge]");
        if (badge) {
          badge.hidden = false;
          badge.textContent = "Purchased";
        }
      }
    });

    document.querySelectorAll("[data-requires-unlock]").forEach((el) => {
      const key = el.getAttribute("data-requires-unlock");
      const ok =
        entitledKeys.has(key) ||
        (BFF.storage && BFF.storage.isUnlocked && BFF.storage.isUnlocked(key));
      el.hidden = !ok;
      el.classList.toggle("is-locked", !ok);
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

  return { toast, startCheckout, stripeCheckoutUrl, refreshUnlockUI, escapeHtml, contactPath };
})();
