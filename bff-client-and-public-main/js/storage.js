/**
 * Local cache helpers (preferences, academy progress).
 * Entitlements are authoritative in Supabase `subscriptions` via Stripe webhooks.
 */
window.BFF = window.BFF || {};

BFF.storage = (function () {
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function isUnlocked(unlockKey) {
    if (!unlockKey) return false;
    try {
      return localStorage.getItem(unlockKey) === "1";
    } catch {
      return false;
    }
  }

  function productUnlocked(productId) {
    const p = BFF.config?.products?.[productId];
    if (!p || !p.unlockKey) return false;
    return isUnlocked(p.unlockKey);
  }

  /**
   * Cache unlock after verified Stripe return (success.html).
   * Server of record remains Supabase subscriptions via webhook.
   */
  function completePurchase(productId, opts) {
    const product = BFF.config?.products?.[productId];
    if (!product || !product.unlockKey) return { ok: false };
    const mode = (opts && opts.mode) || "stripe-return";
    if (mode === "demo") {
      return { ok: false, error: "Demo purchases are disabled" };
    }
    try {
      localStorage.setItem(product.unlockKey, "1");
      localStorage.setItem(
        product.unlockKey + "_meta",
        JSON.stringify({
          productId,
          mode,
          at: new Date().toISOString(),
        })
      );
      if (productId === "academy_enroll") {
        const playbook = BFF.config.products.academy_playbook;
        if (playbook && playbook.unlockKey) {
          localStorage.setItem(playbook.unlockKey, "1");
        }
      }
      window.dispatchEvent(new CustomEvent("bff:unlock", { detail: { productId } }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return {
    get,
    set,
    isUnlocked,
    productUnlocked,
    completePurchase,
  };
})();
