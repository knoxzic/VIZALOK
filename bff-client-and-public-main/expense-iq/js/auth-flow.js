/**
 * Expense IQ — post-auth org bootstrap only.
 * Sign-in / register live solely at pages/auth.html (confirmed email required).
 */
(function () {
  const $ = (id) => document.getElementById(id);

  let pending = {
    user: null,
    memberships: [],
    mfaSecretOnce: null,
    intendedMembership: null,
  };

  function show(viewId) {
    ["gate-loading", "view-mfa", "view-mfa-setup", "view-org-create", "view-org-pick"].forEach(
      (id) => {
        const el = $(id);
        if (el) el.classList.toggle("hidden", id !== viewId);
      }
    );
  }

  function setAlert(id, msg) {
    const el = $(id);
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function mfaEnforced() {
    return !!EIQ.config.REQUIRE_DEMO_MFA;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setGateStatus(text, ok) {
    const el = $("gate-status");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("alert--error", "alert--ok", "alert--warn");
    el.classList.add(ok ? "alert--ok" : "alert--warn");
  }

  async function enterOrg(membership) {
    const user = pending.user;
    const full = (await EIQ.db.getUser(user.user_id)) || user;
    const mfaRequired =
      mfaEnforced() && EIQ.permissions.mfaRequiredForRole(membership.role);

    if (mfaRequired && !full.mfa_enabled) {
      const secret = await EIQ.db.enableMfa(user.user_id);
      pending.mfaSecretOnce = secret;
      pending.intendedMembership = membership;
      $("mfa-setup-code").textContent = secret;
      show("view-mfa-setup");
      return;
    }

    const session = EIQ.db.getSession() || {};
    const mfaVerified = session.mfa_verified === true || !mfaRequired;

    if (mfaRequired && !mfaVerified) {
      pending.intendedMembership = membership;
      EIQ.db.setSession({
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: true,
        mfa_required: true,
        mfa_verified: false,
        org_id: null,
        role: membership.role,
      });
      show("view-mfa");
      return;
    }

    EIQ.db.setSession({
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name || full.display_name,
      mfa_enabled: !!full.mfa_enabled,
      mfa_required: mfaRequired,
      mfa_verified: true,
      org_id: membership.org_id,
      role: membership.role,
      org_name: membership.org_name,
    });
    window.location.href = "app.html";
  }

  function renderOrgPick(list) {
    const root = $("org-pick-list");
    root.innerHTML = list
      .map(
        (m) => `
      <button type="button" class="coa-card" data-org="${m.org_id}" style="width:100%;margin-bottom:8px">
        <strong>${escapeHtml(m.org_name)}</strong>
        <span>${escapeHtml(m.role)} · ${escapeHtml(m.coa_template)} · ${escapeHtml(m.org_type)}</span>
      </button>`
      )
      .join("");
    root.querySelectorAll("[data-org]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const m = list.find((x) => x.org_id === btn.getAttribute("data-org"));
        if (m) await enterOrg(m);
      });
    });
  }

  async function routeAfterAuth() {
    const user = pending.user;
    if (!user) return;

    if (sessionStorage.getItem("eiq_force_new_org") === "1") {
      sessionStorage.removeItem("eiq_force_new_org");
      show("view-org-create");
      return;
    }

    const memberships = await EIQ.db.membershipsForUser(user.user_id);
    pending.memberships = memberships;

    if (!memberships.length) {
      show("view-org-create");
      return;
    }

    if (memberships.length === 1) {
      await enterOrg(memberships[0]);
      return;
    }

    renderOrgPick(memberships);
    show("view-org-pick");
  }

  function initOrgForm() {
    const typeSel = $("org-type");
    if (!typeSel) return;
    typeSel.innerHTML = EIQ.config.orgTypes
      .map((t) => `<option value="${t.value}">${t.label}</option>`)
      .join("");
    $("org-fy").value = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

    const cards = $("coa-cards");
    cards.innerHTML = EIQ.config.coaTemplates
      .map(
        (t, i) => `
      <button type="button" class="coa-card${i === 0 ? " is-selected" : ""}" data-coa="${t.value}">
        <strong>${t.label}</strong>
        <span>${t.blurb}</span>
      </button>`
      )
      .join("");
    cards.querySelectorAll("[data-coa]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cards.querySelectorAll(".coa-card").forEach((c) => c.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        $("coa-template").value = btn.getAttribute("data-coa");
      });
    });
  }

  // Wire org form + MFA (optional)
  if ($("form-org")) {
    $("form-org").addEventListener("submit", async (e) => {
      e.preventDefault();
      setAlert("org-alert", null);
      const btn = $("form-org").querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        const org = await EIQ.db.createOrganization({
          orgName: $("org-name").value,
          orgType: $("org-type").value,
          coaTemplate: $("coa-template").value,
          ein: $("org-ein").value,
          fiscalYearStart: $("org-fy").value,
          ownerUserId: pending.user.user_id,
        });
        await enterOrg({
          org_id: org.org_id,
          role: "owner",
          org_name: org.org_name,
          org_type: org.org_type,
          coa_template: org.coa_template,
        });
      } catch (err) {
        setAlert("org-alert", err.message || "Could not create organization.");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if ($("btn-new-org")) {
    $("btn-new-org").addEventListener("click", () => show("view-org-create"));
  }

  if ($("form-mfa-setup")) {
    $("form-mfa-setup").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ($("mfa-confirm").value.trim() !== pending.mfaSecretOnce) {
        alert("Code does not match.");
        return;
      }
      pending.user.mfa_enabled = true;
      if (pending.intendedMembership) await enterOrg(pending.intendedMembership);
      else await routeAfterAuth();
    });
  }

  if ($("form-mfa")) {
    $("form-mfa").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await EIQ.db.verifyMfaCode(pending.user.user_id, $("mfa-code").value);
      if (!ok) {
        setAlert("mfa-alert", "Incorrect code.");
        return;
      }
      const prev = EIQ.db.getSession() || {};
      EIQ.db.setSession({ ...prev, mfa_verified: true, mfa_required: true });
      if (pending.intendedMembership) await enterOrg(pending.intendedMembership);
      else await routeAfterAuth();
    });
  }

  if ($("btn-mfa-cancel")) {
    $("btn-mfa-cancel").addEventListener("click", async () => {
      await EIQ.db.signOut();
      if (BFF.auth) await BFF.auth.signOut();
      window.location.href = "../pages/auth.html";
    });
  }

  if ($("btn-mfa-regen")) {
    $("btn-mfa-regen").addEventListener("click", async () => {
      if (!pending.user) return;
      const secret = await EIQ.db.enableMfa(pending.user.user_id);
      pending.mfaSecretOnce = secret;
      $("mfa-setup-code").textContent = secret;
    });
  }

  async function boot() {
    initOrgForm();

    if (window.BFF && BFF.config && BFF.config.supabase) {
      EIQ.config.supabase = Object.assign({}, EIQ.config.supabase, BFF.config.supabase);
    }

    // Must have shared BFF auth + access
    if (!window.BFF || !BFF.auth || !BFF.access) {
      setGateStatus("Auth stack missing. Use the site sign-in page.", false);
      return;
    }

    setGateStatus("Verifying confirmed email & subscription…", false);

    const next = window.location.href;
    const gate = await BFF.access.requireProduct("expense_iq", { next: next });
    if (!gate || !gate.user) {
      // requireProduct redirects to central auth / paywall
      setGateStatus("Redirecting to secure sign-in…", false);
      return;
    }

    // Map Supabase user into EIQ session shape
    const u = gate.user;
    const display =
      (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.display_name)) ||
      (u.email || "").split("@")[0];

    // Ensure EIQ profile row exists (supabase adapter)
    if (EIQ.db.isSupabase) {
      try {
        await EIQ.db.hydrateFromAuth();
      } catch (e) {
        console.warn("[EIQ] hydrate", e);
      }
    }

    pending.user = {
      user_id: u.id,
      email: u.email,
      display_name: display,
      mfa_enabled: false,
    };

    // Refresh from EIQ profile if present
    try {
      const profile = await EIQ.db.getUser(u.id);
      if (profile) {
        pending.user.display_name = profile.display_name || display;
        pending.user.mfa_enabled = !!profile.mfa_enabled;
      }
    } catch (_) {}

    EIQ.db.setSession({
      user_id: pending.user.user_id,
      email: pending.user.email,
      display_name: pending.user.display_name,
      mfa_enabled: pending.user.mfa_enabled,
      mfa_required: false,
      mfa_verified: true,
      org_id: null,
      role: null,
    });

    setGateStatus("Access granted · loading workspace…", true);
    await routeAfterAuth();
  }

  boot().catch((err) => {
    console.error(err);
    setGateStatus(err.message || "Access check failed", false);
  });
})();
