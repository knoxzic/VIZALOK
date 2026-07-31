/**
 * Expense IQ™ — local multi-tenant data layer
 * Every financial/org query is scoped by org_id.
 * Later: same method shapes for Firebase / Supabase adapters.
 */
(function () {
  const KEY = () => (window.EIQ && EIQ.config && EIQ.config.storageKey) || "eiq_v1";

  function emptyStore() {
    return {
      users: [],
      organizations: [],
      org_users: [],
      audit_log: [],
      // Phase 2+ tables stubbed so the spine is visible
      transactions: [],
      chart_of_accounts: [],
      receipts: [],
      grants: [],
      mileage_trips: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY());
      if (!raw) return emptyStore();
      return Object.assign(emptyStore(), JSON.parse(raw));
    } catch {
      return emptyStore();
    }
  }

  function save(store) {
    localStorage.setItem(KEY(), JSON.stringify(store));
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Demo-only password digest — replace with real auth provider */
  async function digest(password, salt) {
    const data = new TextEncoder().encode(salt + ":" + password);
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return btoa(salt + ":" + password);
  }

  function now() {
    return new Date().toISOString();
  }

  function audit(store, entry) {
    store.audit_log.push({
      log_id: uuid(),
      timestamp: now(),
      ...entry,
    });
  }

  const db = {
    uuid,
    digest,
    now,
    load,
    save,

    getSession() {
      try {
        return JSON.parse(sessionStorage.getItem("eiq_session") || "null");
      } catch {
        return null;
      }
    },

    setSession(session) {
      if (!session) sessionStorage.removeItem("eiq_session");
      else sessionStorage.setItem("eiq_session", JSON.stringify(session));
    },

    findUserByEmail(email) {
      const store = load();
      const e = (email || "").trim().toLowerCase();
      return store.users.find((u) => u.email === e) || null;
    },

    getUser(userId) {
      return load().users.find((u) => u.user_id === userId) || null;
    },

    async registerUser({ email, password, displayName }) {
      const store = load();
      const e = email.trim().toLowerCase();
      if (store.users.some((u) => u.email === e)) {
        throw new Error("An account with that email already exists.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      const user_id = uuid();
      const password_salt = uuid().slice(0, 8);
      const password_hash = await digest(password, password_salt);
      const user = {
        user_id,
        email: e,
        display_name: displayName.trim() || e.split("@")[0],
        password_salt,
        password_hash,
        mfa_enabled: false,
        mfa_secret: null,
        created_at: now(),
      };
      store.users.push(user);
      audit(store, {
        org_id: null,
        user_id,
        action: "create",
        entity_type: "user",
        entity_id: user_id,
        before_value: null,
        after_value: { email: e },
      });
      save(store);
      return { user_id, email: e, display_name: user.display_name, mfa_enabled: false };
    },

    async verifyPassword(email, password) {
      const user = this.findUserByEmail(email);
      if (!user) return null;
      const hash = await digest(password, user.password_salt);
      if (hash !== user.password_hash) return null;
      return {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: !!user.mfa_enabled,
      };
    },

    enableMfa(userId) {
      const store = load();
      const user = store.users.find((u) => u.user_id === userId);
      if (!user) throw new Error("User not found.");
      // 6-digit demo secret (shown once); real TOTP later
      const secret = String(Math.floor(100000 + Math.random() * 900000));
      const before = { mfa_enabled: user.mfa_enabled };
      user.mfa_enabled = true;
      user.mfa_secret = secret;
      audit(store, {
        org_id: null,
        user_id: userId,
        action: "permission_change",
        entity_type: "user",
        entity_id: userId,
        before_value: before,
        after_value: { mfa_enabled: true },
      });
      save(store);
      return secret;
    },

    verifyMfaCode(userId, code) {
      const user = this.getUser(userId);
      if (!user || !user.mfa_enabled) return false;
      return String(code).trim() === String(user.mfa_secret);
    },

    createOrganization({ orgName, orgType, coaTemplate, ein, fiscalYearStart, ownerUserId }) {
      const store = load();
      const org_id = uuid();
      const org = {
        org_id,
        org_name: orgName.trim(),
        org_type: orgType,
        coa_template: coaTemplate,
        ein: (ein || "").trim(),
        fiscal_year_start: fiscalYearStart || new Date().toISOString().slice(0, 10),
        created_at: now(),
        created_by: ownerUserId,
      };
      store.organizations.push(org);
      store.org_users.push({
        id: uuid(),
        user_id: ownerUserId,
        org_id,
        role: "owner",
        joined_at: now(),
      });
      audit(store, {
        org_id,
        user_id: ownerUserId,
        action: "create",
        entity_type: "organization",
        entity_id: org_id,
        before_value: null,
        after_value: {
          org_name: org.org_name,
          org_type: org.org_type,
          coa_template: org.coa_template,
        },
      });
      save(store);
      return org;
    },

    updateOrganization(orgId, patch, actorUserId) {
      const store = load();
      const org = store.organizations.find((o) => o.org_id === orgId);
      if (!org) throw new Error("Organization not found.");
      const before = { ...org };
      Object.assign(org, patch, { updated_at: now() });
      audit(store, {
        org_id: orgId,
        user_id: actorUserId,
        action: "edit",
        entity_type: "organization",
        entity_id: orgId,
        before_value: before,
        after_value: { ...org },
      });
      save(store);
      return org;
    },

    /** All memberships for a user (multi-org) */
    membershipsForUser(userId) {
      const store = load();
      return store.org_users
        .filter((m) => m.user_id === userId)
        .map((m) => {
          const org = store.organizations.find((o) => o.org_id === m.org_id);
          return org
            ? {
                org_id: m.org_id,
                role: m.role,
                org_name: org.org_name,
                org_type: org.org_type,
                coa_template: org.coa_template,
              }
            : null;
        })
        .filter(Boolean);
    },

    getOrg(orgId) {
      return load().organizations.find((o) => o.org_id === orgId) || null;
    },

    getMembership(userId, orgId) {
      return (
        load().org_users.find((m) => m.user_id === userId && m.org_id === orgId) || null
      );
    },

    /**
     * Scoped query helper — every list path must pass org_id.
     * Phase 1 uses this pattern; later adapters enforce the same contract.
     */
    scoped(orgId, table) {
      if (!orgId) throw new Error("org_id is required — no unscoped queries.");
      const store = load();
      const rows = store[table];
      if (!Array.isArray(rows)) return [];
      return rows.filter((r) => r.org_id === orgId);
    },

    membersOfOrg(orgId) {
      const store = load();
      return store.org_users
        .filter((m) => m.org_id === orgId)
        .map((m) => {
          const u = store.users.find((x) => x.user_id === m.user_id);
          return {
            user_id: m.user_id,
            role: m.role,
            email: u ? u.email : "?",
            display_name: u ? u.display_name : "?",
            mfa_enabled: u ? !!u.mfa_enabled : false,
          };
        });
    },

    inviteMember({ orgId, email, role, actorUserId }) {
      const store = load();
      const e = email.trim().toLowerCase();
      let user = store.users.find((u) => u.email === e);
      if (!user) {
        throw new Error(
          "User must register first (local demo). Ask them to create an account, then invite by email."
        );
      }
      if (store.org_users.some((m) => m.user_id === user.user_id && m.org_id === orgId)) {
        throw new Error("User is already a member of this organization.");
      }
      if (!(EIQ.config.roles || []).includes(role)) {
        throw new Error("Invalid role.");
      }
      store.org_users.push({
        id: uuid(),
        user_id: user.user_id,
        org_id: orgId,
        role,
        joined_at: now(),
      });
      audit(store, {
        org_id: orgId,
        user_id: actorUserId,
        action: "permission_change",
        entity_type: "org_users",
        entity_id: user.user_id,
        before_value: null,
        after_value: { email: e, role },
      });
      save(store);
      return true;
    },

    recentAudit(orgId, limit) {
      const store = load();
      return store.audit_log
        .filter((a) => a.org_id === orgId || a.org_id === null)
        .slice()
        .reverse()
        .slice(0, limit || 20);
    },

    stats(orgId) {
      return {
        transactions: this.scoped(orgId, "transactions").length,
        receipts: this.scoped(orgId, "receipts").length,
        grants: this.scoped(orgId, "grants").length,
        mileage: this.scoped(orgId, "mileage_trips").length,
        posted: this.scoped(orgId, "transactions").filter((t) => t.status === "posted")
          .length,
      };
    },

    wipeAll() {
      localStorage.removeItem(KEY());
      sessionStorage.removeItem("eiq_session");
    },
  };

  EIQ.db = db;
})();
