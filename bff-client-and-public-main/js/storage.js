/**
 * Demo unlocks + purchase state via localStorage.
 * Real webhooks will write the same keys (or Firestore flags) later —
 * UI already checks isUnlocked() so no portal refactor is needed.
 */
window.BFF = window.BFF || {};

BFF.storage = (function () {
  const PREFIX = "bff_";
  const ORDERS_KEY = "bff_demo_orders";

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value)
      );
    } catch (e) {
      console.warn("BFF storage write failed", e);
    }
  }

  function isUnlocked(unlockKey) {
    if (!unlockKey) return false;
    return get(unlockKey) === true || get(unlockKey) === "true";
  }

  function unlock(unlockKey, meta = {}) {
    if (!unlockKey) return;
    set(unlockKey, true);
    set(unlockKey + "_meta", {
      unlockedAt: new Date().toISOString(),
      ...meta,
    });
    const orders = get(ORDERS_KEY, []);
    orders.unshift({
      unlockKey,
      ...meta,
      at: new Date().toISOString(),
    });
    set(ORDERS_KEY, orders.slice(0, 50));

    // Mirror shape for future webhook payload consumers
    window.dispatchEvent(
      new CustomEvent("bff:unlock", { detail: { unlockKey, meta } })
    );
  }

  function lock(unlockKey) {
    try {
      localStorage.removeItem(unlockKey);
      localStorage.removeItem(unlockKey + "_meta");
    } catch {}
  }

  function getOrders() {
    return get(ORDERS_KEY, []);
  }

  function clearDemo() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }

  function productUnlocked(productId) {
    const p = BFF.config?.products?.[productId];
    return p ? isUnlocked(p.unlockKey) : false;
  }

  /**
   * Simulate post-checkout success (demo).
   * Later: success.html reads session_id and calls backend to verify.
   */
  function completePurchase(productId, opts = {}) {
    const product = BFF.config?.products?.[productId];
    if (!product) return { ok: false, error: "Unknown product" };

    unlock(product.unlockKey, {
      productId,
      name: product.name,
      price: product.price,
      mode: opts.mode || "demo",
      email: opts.email || null,
    });

    // Academy enrollment also unlocks the graduate playbook in demo
    if (productId === "academy_enroll") {
      unlock(BFF.config.products.academy_playbook.unlockKey, {
        productId: "academy_playbook",
        name: BFF.config.products.academy_playbook.name,
        via: "academy_enroll",
        mode: opts.mode || "demo",
      });
    }

    return { ok: true, product };
  }

  return {
    get,
    set,
    isUnlocked,
    unlock,
    lock,
    getOrders,
    clearDemo,
    productUnlocked,
    completePurchase,
    ORDERS_KEY,
  };
})();
