/**
 * Access + paywall helpers.
 * Confirmed email is required first; product subscriptions unlock paid apps.
 *
 * products (product_key):
 *   expense_iq | academy | full_suite | insurance_crm | financial_ops
 */
(function () {
  window.BFF = window.BFF || {};

  function client() {
    if (!BFF.supabase || !BFF.supabase.getClient) return null;
    return BFF.supabase.getClient();
  }

  const PRODUCT_LABELS = {
    expense_iq: "Expense IQ",
    academy: "Business Academy",
    full_suite: "BFF Full Suite",
    insurance_crm: "Insurance CRM",
    financial_ops: "Financial Operations",
  };

  /**
   * Active entitlement if:
   * - status in (active, trialing)
   * - current_period_end is null or in the future
   */
  function isEntitlementActive(row) {
    if (!row) return false;
    const ok = row.status === "active" || row.status === "trialing";
    if (!ok) return false;
    if (!row.current_period_end) return true;
    return new Date(row.current_period_end).getTime() > Date.now();
  }

  async function listSubscriptions(userId) {
    const sb = client();
    if (!sb || !userId) return [];
    const { data, error } = await sb
      .from("subscriptions")
      .select("*")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      // Table may not exist yet — fail closed for paid products (except staff override)
      console.warn("[BFF.access] subscriptions", error.message);
      return [];
    }
    return data || [];
  }

  async function hasProduct(userId, productKey) {
    if (!userId || !productKey) return false;
    const rows = await listSubscriptions(userId);
    // full_suite covers all product keys
    return rows.some(
      (r) =>
        isEntitlementActive(r) &&
        (r.product_key === productKey || r.product_key === "full_suite")
    );
  }

  async function getProfile(userId) {
    const sb = client();
    if (!sb || !userId) return null;
    const { data } = await sb
      .from("profiles")
      .select("*")
      .eq("profile_id", userId)
      .maybeSingle();
    return data || null;
  }

  function isStaffRole(role) {
    return ["principal", "agent", "associate", "bookkeeper", "csr"].includes(role);
  }

  /**
   * Full gate for a paid product.
   * 1) Confirmed email (via BFF.auth)
   * 2) Active subscription OR staff principal bypass
   *
   * @returns {Promise<{user, entitled, profile, reason}|null>} null if redirected
   */
  async function requireProduct(productKey, options) {
    const opts = options || {};
    const next = opts.next || window.location.href;

    if (!BFF.auth || !BFF.auth.requireConfirmedUser) {
      console.error("[BFF.access] BFF.auth not loaded");
      return null;
    }

    const auth = await BFF.auth.requireConfirmedUser({ next });
    if (!auth || !auth.user) return null;

    const user = auth.user;
    const profile = await getProfile(user.id);
    const staffBypass =
      opts.allowStaff !== false && profile && isStaffRole(profile.role);

    if (staffBypass) {
      return { user, entitled: true, profile, reason: "staff", productKey };
    }

    // Optional free-preview until Stripe is wired (set false in production)
    const freePreview =
      BFF.config && BFF.config.PAYWALL && BFF.config.PAYWALL.freePreview === true;

    if (freePreview) {
      return { user, entitled: true, profile, reason: "free_preview", productKey };
    }

    const entitled = await hasProduct(user.id, productKey);
    if (!entitled) {
      // Stay on auth with paywall panel
      const base = BFF.auth.authPath();
      const params = new URLSearchParams({
        next: next,
        reason: "paywall",
        product: productKey,
      });
      window.location.href = base + "?" + params.toString();
      return null;
    }

    return { user, entitled: true, profile, reason: "subscription", productKey };
  }

  BFF.access = {
    PRODUCT_LABELS,
    listSubscriptions,
    hasProduct,
    getProfile,
    isEntitlementActive,
    requireProduct,
    isStaffRole,
  };
})();
