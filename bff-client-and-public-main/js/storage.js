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

  /**
   * Local cache only — NOT proof of purchase for UI.
   * Purchase UI must use BFF.ui.getVerifiedEntitlements() (signed-in + Supabase).
   */
  function productUnlocked() {
    return false;
  }

  /**
   * Do not mark products purchased from the browser alone.
   * Webhook → subscriptions is the source of truth.
   */
  function completePurchase() {
    return { ok: false, error: "Purchase verification is server-side only" };
  }

  return {
    get,
    set,
    isUnlocked,
    productUnlocked,
    completePurchase,
  };
})();
