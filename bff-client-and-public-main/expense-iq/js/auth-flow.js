/**
 * Expense IQ™ — login / register / MFA / org bootstrap
 */
(function () {
  const $ = (id) => document.getElementById(id);

  let pending = {
    user: null,
    memberships: [],
    mfaSecretOnce: null,
    needsMfaSetup: false,
  };

  function show(viewId) {
    ["view-auth", "view-mfa", "view-mfa-setup", "view-org-create", "view-org-pick"].forEach(
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

  function resumeIfSession() {
    const s = EIQ.db.getSession();
    if (!s || !s.user_id) return;

    pending.user = {
      user_id: s.user_id,
      email: s.email,
      display_name: s.display_name,
      mfa_enabled: s.mfa_enabled,
    };

    // Explicit "create another org" from app
    if (sessionStorage.getItem("eiq_force_new_org") === "1") {
      sessionStorage.removeItem("eiq_force_new_org");
      show("view-org-create");
      return;
    }

    if (!s.org_id) {
      pending.memberships = EIQ.db.membershipsForUser(s.user_id);
      routeAfterAuth();
      return;
    }
    if (s.mfa_required && !s.mfa_verified) {
      pending.user = {
        user_id: s.user_id,
        email: s.email,
        display_name: s.display_name,
        mfa_enabled: s.mfa_enabled,
      };
      show("view-mfa");
      return;
    }
    window.location.href = "app.html";
  }

  function routeAfterAuth() {
    const user = pending.user;
    if (!user) return;

    const memberships = EIQ.db.membershipsForUser(user.user_id);
    pending.memberships = memberships;

    // No org yet → create
    if (!memberships.length) {
      // Creating first org as owner → MFA will be required
      const full = EIQ.db.getUser(user.user_id);
      if (!full.mfa_enabled) {
        pending.needsMfaSetup = true;
        const secret = EIQ.db.enableMfa(user.user_id);
        pending.mfaSecretOnce = secret;
        $("mfa-setup-code").textContent = secret;
        show("view-mfa-setup");
        return;
      }
      show("view-org-create");
      return;
    }

    // Has orgs — if any membership is MFA-required role without MFA, setup
    const needsRoleMfa = memberships.some((m) =>
      EIQ.permissions.mfaRequiredForRole(m.role)
    );
    const full = EIQ.db.getUser(user.user_id);
    if (needsRoleMfa && !full.mfa_enabled) {
      pending.needsMfaSetup = true;
      const secret = EIQ.db.enableMfa(user.user_id);
      pending.mfaSecretOnce = secret;
      $("mfa-setup-code").textContent = secret;
      show("view-mfa-setup");
      return;
    }

    if (needsRoleMfa && full.mfa_enabled) {
      // Require verify this session
      EIQ.db.setSession({
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: true,
        mfa_required: true,
        mfa_verified: false,
        org_id: null,
        role: null,
      });
      show("view-mfa");
      return;
    }

    if (memberships.length === 1) {
      enterOrg(memberships[0]);
      return;
    }

    renderOrgPick(memberships);
    show("view-org-pick");
  }

  function enterOrg(membership) {
    const user = pending.user;
    const full = EIQ.db.getUser(user.user_id);
    const mfaRequired = EIQ.permissions.mfaRequiredForRole(membership.role);

    if (mfaRequired && !full.mfa_enabled) {
      pending.needsMfaSetup = true;
      const secret = EIQ.db.enableMfa(user.user_id);
      pending.mfaSecretOnce = secret;
      $("mfa-setup-code").textContent = secret;
      show("view-mfa-setup");
      // stash intended org
      pending.intendedMembership = membership;
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
      mfa_verified: mfaRequired ? true : true,
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
        <span>${escapeHtml(m.role)} · ${escapeHtml(m.coa_template)} template · ${escapeHtml(m.org_type)}</span>
      </button>`
      )
      .join("");
    root.querySelectorAll("[data-org]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = list.find((x) => x.org_id === btn.getAttribute("data-org"));
        if (m) enterOrg(m);
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initOrgForm() {
    const typeSel = $("org-type");
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

  // Tabs
  $("tab-login").addEventListener("click", () => {
    $("tab-login").classList.add("is-active");
    $("tab-register").classList.remove("is-active");
    $("form-login").classList.remove("hidden");
    $("form-register").classList.add("hidden");
    setAlert("auth-alert", null);
  });
  $("tab-register").addEventListener("click", () => {
    $("tab-register").classList.add("is-active");
    $("tab-login").classList.remove("is-active");
    $("form-register").classList.remove("hidden");
    $("form-login").classList.add("hidden");
    setAlert("auth-alert", null);
  });

  $("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("auth-alert", null);
    try {
      const user = await EIQ.db.verifyPassword(
        $("login-email").value,
        $("login-password").value
      );
      if (!user) {
        setAlert("auth-alert", "Invalid email or password.");
        return;
      }
      pending.user = user;
      routeAfterAuth();
    } catch (err) {
      setAlert("auth-alert", err.message || "Sign-in failed.");
    }
  });

  $("form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    setAlert("auth-alert", null);
    try {
      const user = await EIQ.db.registerUser({
        email: $("reg-email").value,
        password: $("reg-password").value,
        displayName: $("reg-name").value,
      });
      pending.user = user;
      routeAfterAuth();
    } catch (err) {
      setAlert("auth-alert", err.message || "Registration failed.");
    }
  });

  $("form-mfa-setup").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("mfa-confirm").value.trim();
    if (code !== pending.mfaSecretOnce) {
      alert("Code does not match. Check the number above.");
      return;
    }
    pending.user.mfa_enabled = true;
    EIQ.db.setSession({
      user_id: pending.user.user_id,
      email: pending.user.email,
      display_name: pending.user.display_name,
      mfa_enabled: true,
      mfa_required: true,
      mfa_verified: true,
      org_id: null,
      role: null,
    });
    if (pending.intendedMembership) {
      enterOrg(pending.intendedMembership);
      return;
    }
    const memberships = EIQ.db.membershipsForUser(pending.user.user_id);
    if (!memberships.length) {
      show("view-org-create");
      return;
    }
    if (memberships.length === 1) {
      enterOrg(memberships[0]);
      return;
    }
    renderOrgPick(memberships);
    show("view-org-pick");
  });

  $("form-mfa").addEventListener("submit", (e) => {
    e.preventDefault();
    setAlert("mfa-alert", null);
    const ok = EIQ.db.verifyMfaCode(pending.user.user_id, $("mfa-code").value);
    if (!ok) {
      setAlert("mfa-alert", "Incorrect code.");
      return;
    }
    const prev = EIQ.db.getSession() || {};
    EIQ.db.setSession({
      ...prev,
      user_id: pending.user.user_id,
      email: pending.user.email,
      display_name: pending.user.display_name,
      mfa_enabled: true,
      mfa_required: true,
      mfa_verified: true,
    });
    const memberships = EIQ.db.membershipsForUser(pending.user.user_id);
    if (pending.intendedMembership) {
      enterOrg(pending.intendedMembership);
      return;
    }
    if (!memberships.length) {
      show("view-org-create");
      return;
    }
    if (memberships.length === 1) {
      enterOrg(memberships[0]);
      return;
    }
    renderOrgPick(memberships);
    show("view-org-pick");
  });

  $("btn-mfa-cancel").addEventListener("click", () => {
    EIQ.db.setSession(null);
    pending = { user: null, memberships: [], mfaSecretOnce: null, needsMfaSetup: false };
    show("view-auth");
  });

  $("btn-mfa-regen").addEventListener("click", () => {
    if (!pending.user) return;
    const secret = EIQ.db.enableMfa(pending.user.user_id);
    pending.mfaSecretOnce = secret;
    pending.user.mfa_enabled = true;
    $("mfa-setup-code").textContent = secret;
    alert("New demo MFA code: " + secret + "\nSave it, then enter it above.");
  });

  $("form-org").addEventListener("submit", (e) => {
    e.preventDefault();
    setAlert("org-alert", null);
    try {
      const org = EIQ.db.createOrganization({
        orgName: $("org-name").value,
        orgType: $("org-type").value,
        coaTemplate: $("coa-template").value,
        ein: $("org-ein").value,
        fiscalYearStart: $("org-fy").value,
        ownerUserId: pending.user.user_id,
      });
      enterOrg({
        org_id: org.org_id,
        role: "owner",
        org_name: org.org_name,
        org_type: org.org_type,
        coa_template: org.coa_template,
      });
    } catch (err) {
      setAlert("org-alert", err.message || "Could not create organization.");
    }
  });

  $("btn-new-org").addEventListener("click", () => show("view-org-create"));

  initOrgForm();
  resumeIfSession();
})();
