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

    toast("Opening secure Stripe checkout…");
    const apiUrl = await createCheckoutSession(product);
    if (apiUrl) {
      window.location.href = apiUrl;
      return;
    }
    const href = await stripeCheckoutUrl(product);
    if (!href) {
      toast("Checkout unavailable. Contact us.");
      return;
    }
    window.open(href, "_blank", "noopener");
  }

  async function createCheckoutSession(product) {
    try {
      const sb = BFF.supabase && BFF.supabase.getClient && BFF.supabase.getClient();
      const cfg = BFF.config || {};
      const fn = (cfg.stripe && cfg.stripe.createCheckoutFn) || "create-checkout";
      if (!sb || !cfg.supabase || !cfg.supabase.url) return "";

      const origin = location.origin + location.pathname.replace(/[^/]+$/, "");
      const success =
        origin +
        (cfg.successPath || "success.html") +
        "?session_id={CHECKOUT_SESSION_ID}&product=" +
        encodeURIComponent(product.id);
      const cancel = location.href;

      let email = "";
      try {
        const { user } = (BFF.auth && (await BFF.auth.getUser())) || {};
        if (user && user.email) email = user.email;
      } catch (_) {}

      const { data, error } = await sb.functions.invoke(fn, {
        body: {
          productKey: product.id,
          successUrl: success,
          cancelUrl: cancel,
          email,
        },
      });
      if (error) {
        console.warn("[BFF] create-checkout", error);
        return "";
      }
      return (data && data.url) || "";
    } catch (err) {
      console.warn("[BFF] create-checkout failed, using Payment Link", err);
      return "";
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * "Purchased" only if signed in + confirmed email + active Supabase subscription.
   * Never trust localStorage alone for purchase UI.
   */
  async function getVerifiedEntitlements() {
    const entitledKeys = new Set();
    try {
      if (!BFF.auth || !BFF.access) return { signedIn: false, keys: entitledKeys };
      const { user } = await BFF.auth.getUser();
      if (!user) return { signedIn: false, keys: entitledKeys };
      if (BFF.auth.isEmailConfirmed && !BFF.auth.isEmailConfirmed(user)) {
        return { signedIn: false, keys: entitledKeys };
      }
      const rows = await BFF.access.listSubscriptions(user.id);
      rows.forEach((r) => {
        if (BFF.access.isEntitlementActive(r)) entitledKeys.add(r.product_key);
      });
      return { signedIn: true, keys: entitledKeys, user };
    } catch (_) {
      return { signedIn: false, keys: entitledKeys };
    }
  }

  async function refreshUnlockUI() {
    const { signedIn, keys: entitledKeys } = await getVerifiedEntitlements();

    document.querySelectorAll("[data-product]").forEach((el) => {
      const id = el.getAttribute("data-product");
      const product = resolveProduct(id);
      const live = product && product.stripeUrl && !product.inactive && !product.comingSoon;
      const unlocked =
        signedIn && (entitledKeys.has(id) || entitledKeys.has("full_suite"));

      el.classList.toggle("is-unlocked", unlocked);

      const btn = el.querySelector("[data-buy]");
      if (btn) {
        btn.disabled = unlocked;
        if (unlocked) {
          btn.textContent = "Purchased";
          btn.classList.remove("btn--primary", "btn--gold");
          btn.classList.add("btn--outline");
        } else {
          // Restore buy CTA (do not leave stale Purchased from prior render)
          if (product && product.comingSoon) {
            btn.textContent = "Coming soon";
            btn.classList.remove("btn--primary", "btn--gold");
            btn.classList.add("btn--outline");
          } else if (live) {
            btn.textContent = "Buy with Stripe";
            btn.classList.remove("btn--outline");
            if (product && product.popular) {
              btn.classList.add("btn--gold");
              btn.classList.remove("btn--primary");
            } else {
              btn.classList.add("btn--primary");
              btn.classList.remove("btn--gold");
            }
          } else if (!btn.textContent || /purchased/i.test(btn.textContent)) {
            // Quote / non-stripe buttons keep their own label unless wrongly set
            if (/purchased/i.test(btn.textContent)) {
              btn.textContent = live ? "Buy with Stripe" : "Request quote";
              btn.classList.remove("btn--outline");
              btn.classList.add("btn--primary");
            }
          }
          btn.disabled = false;
        }
      }

      const badge = el.querySelector("[data-unlock-badge]");
      if (badge) {
        badge.hidden = !unlocked;
        badge.textContent = unlocked ? "Purchased" : "";
      }
    });

    document.querySelectorAll("[data-requires-unlock]").forEach((el) => {
      const key = el.getAttribute("data-requires-unlock");
      const ok = signedIn && entitledKeys.has(key);
      el.hidden = !ok;
      el.classList.toggle("is-locked", !ok);
    });
  }

  function injectBrandPhone() {
    var brand = (window.BFF && BFF.config && BFF.config.brand) || {};
    var tel = brand.phone || "+18558884233";
    var vanity = brand.phoneVanity || "1-855-888-4BFF";
    var display = brand.phoneDisplay || "1-855-888-4233";

    document.querySelectorAll(".site-nav__cta").forEach(function (cta) {
      if (cta.querySelector("[data-bff-phone]")) return;
      var a = document.createElement("a");
      a.href = "tel:" + tel;
      a.className = "nav-phone";
      a.setAttribute("data-bff-phone", "");
      a.setAttribute("aria-label", "Call " + display);
      a.textContent = vanity;
      cta.insertBefore(a, cta.firstChild);
    });

    document.querySelectorAll(".site-nav__links").forEach(function (links) {
      if (links.querySelector("[data-bff-phone]")) return;
      var li = document.createElement("li");
      li.className = "is-phone";
      var a = document.createElement("a");
      a.href = "tel:" + tel;
      a.setAttribute("data-bff-phone", "");
      a.textContent = display;
      li.appendChild(a);
      links.appendChild(li);
    });
  }

  function init() {
    initNav();
    setYear();
    injectBrandPhone();
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

  return {
    toast,
    startCheckout,
    stripeCheckoutUrl,
    createCheckoutSession,
    refreshUnlockUI,
    getVerifiedEntitlements,
    escapeHtml,
    contactPath,
  };
})();
