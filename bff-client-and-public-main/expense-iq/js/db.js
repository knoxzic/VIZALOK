/**
 * Expense IQ™ — data layer facade
 * STORAGE_MODE: "local" | "supabase"
 * Supabase path = multi-tenant cloud DB (custom org data per signed-in user).
 */
(function () {
  const KEY = () => (window.EIQ && EIQ.config && EIQ.config.storageKey) || "eiq_v1";

  function mode() {
    return (EIQ.config && EIQ.config.STORAGE_MODE) || "local";
  }

  function emptyStore() {
    return {
      users: [],
      organizations: [],
      org_users: [],
      audit_log: [],
      transactions: [],
      chart_of_accounts: [],
      receipts: [],
      grants: [],
      mileage_trips: [],
      tasks: [],
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

  const localDb = {
    uuid,
    digest,
    now,
    load,
    save,
    isSupabase: false,

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

    async ready() {
      return true;
    },

    async status() {
      return { ok: true, mode: "local", message: "Local browser storage" };
    },

    async hydrateFromAuth() {
      return this.getSession();
    },

    findUserByEmail(email) {
      const store = load();
      const e = (email || "").trim().toLowerCase();
      return store.users.find((u) => u.email === e) || null;
    },

    async getUser(userId) {
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

    async signOut() {
      this.setSession(null);
    },

    async enableMfa(userId) {
      const store = load();
      const user = store.users.find((u) => u.user_id === userId);
      if (!user) throw new Error("User not found.");
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

    async verifyMfaCode(userId, code) {
      const user = await this.getUser(userId);
      if (!user || !user.mfa_enabled) return false;
      return String(code).trim() === String(user.mfa_secret);
    },

    async createOrganization({ orgName, orgType, coaTemplate, ein, fiscalYearStart, ownerUserId }) {
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

    async updateOrganization(orgId, patch, actorUserId) {
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

    async membershipsForUser(userId) {
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

    async getOrg(orgId) {
      return load().organizations.find((o) => o.org_id === orgId) || null;
    },

    async getMembership(userId, orgId) {
      return (
        load().org_users.find((m) => m.user_id === userId && m.org_id === orgId) || null
      );
    },

    async scoped(orgId, table) {
      if (!orgId) throw new Error("org_id is required — no unscoped queries.");
      const store = load();
      const rows = store[table];
      if (!Array.isArray(rows)) return [];
      return rows.filter((r) => r.org_id === orgId);
    },

    async membersOfOrg(orgId) {
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

    async inviteMember({ orgId, email, role, actorUserId }) {
      const store = load();
      const e = email.trim().toLowerCase();
      let user = store.users.find((u) => u.email === e);
      if (!user) {
        throw new Error(
          "User must register first. Ask them to create an account, then invite by email."
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

    async recentAudit(orgId, limit) {
      const store = load();
      return store.audit_log
        .filter((a) => a.org_id === orgId || a.org_id === null)
        .slice()
        .reverse()
        .slice(0, limit || 20);
    },

    async stats(orgId) {
      const transactions = await this.scoped(orgId, "transactions");
      const receipts = await this.scoped(orgId, "receipts");
      const grants = await this.scoped(orgId, "grants");
      const mileage = await this.scoped(orgId, "mileage_trips");
      return {
        transactions: transactions.length,
        receipts: receipts.length,
        grants: grants.length,
        mileage: mileage.length,
        posted: transactions.filter((t) => t.status === "posted").length,
      };
    },

    async wipeAll() {
      localStorage.removeItem(KEY());
      sessionStorage.removeItem("eiq_session");
    },

    async listReceipts(orgId) {
      const rows = await this.scoped(orgId, "receipts");
      return rows
        .slice()
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.created_at || "").localeCompare(a.created_at || ""));
    },

    async createReceipt(orgId, data, userId) {
      const store = load();
      const receipt = {
        id: uuid(),
        org_id: orgId,
        vendor: data.vendor || "Unknown",
        date: data.date || now().slice(0, 10),
        total: Number(data.total) || 0,
        category: data.category || "Uncategorized",
        items: Array.isArray(data.items) ? data.items : [],
        engine: data.engine || null,
        created_by: userId,
        created_at: now(),
      };
      store.receipts.push(receipt);
      audit(store, {
        org_id: orgId,
        user_id: userId,
        action: "create",
        entity_type: "receipt",
        entity_id: receipt.id,
        before_value: null,
        after_value: { vendor: receipt.vendor, total: receipt.total },
      });
      save(store);
      return receipt;
    },

    async deleteReceipt(receiptId, orgId, userId) {
      const store = load();
      const receipt = store.receipts.find((r) => r.id === receiptId && r.org_id === orgId);
      store.receipts = store.receipts.filter((r) => !(r.id === receiptId && r.org_id === orgId));
      audit(store, {
        org_id: orgId,
        user_id: userId,
        action: "delete",
        entity_type: "receipt",
        entity_id: receiptId,
        before_value: receipt || null,
        after_value: null,
      });
      save(store);
      return true;
    },

    async listTasks(orgId) {
      const rows = await this.scoped(orgId, "tasks");
      return rows
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
    },

    async createTask(orgId, data, userId) {
      const store = load();
      const task = {
        id: uuid(),
        org_id: orgId,
        type: data.type === "booking" ? "booking" : "task",
        title: data.title,
        date: data.date || null,
        time: data.time || null,
        notes: data.notes || "",
        done: false,
        created_by: userId,
        created_at: now(),
      };
      store.tasks.push(task);
      audit(store, {
        org_id: orgId,
        user_id: userId,
        action: "create",
        entity_type: "task",
        entity_id: task.id,
        before_value: null,
        after_value: { type: task.type, title: task.title },
      });
      save(store);
      return task;
    },

    async updateTask(taskId, orgId, patch, userId) {
      const store = load();
      const task = store.tasks.find((t) => t.id === taskId && t.org_id === orgId);
      if (!task) throw new Error("Task not found.");
      const before = { ...task };
      Object.assign(task, patch, { updated_at: now() });
      audit(store, {
        org_id: orgId,
        user_id: userId,
        action: "edit",
        entity_type: "task",
        entity_id: taskId,
        before_value: before,
        after_value: { ...task },
      });
      save(store);
      return task;
    },

    async deleteTask(taskId, orgId, userId) {
      const store = load();
      const task = store.tasks.find((t) => t.id === taskId && t.org_id === orgId);
      store.tasks = store.tasks.filter((t) => !(t.id === taskId && t.org_id === orgId));
      audit(store, {
        org_id: orgId,
        user_id: userId,
        action: "delete",
        entity_type: "task",
        entity_id: taskId,
        before_value: task || null,
        after_value: null,
      });
      save(store);
      return true;
    },

    async invokeAi() {
      throw new Error("AI capture requires cloud mode. Use the Local OCR engine instead.");
    },
  };

  function active() {
    if (mode() === "supabase" && EIQ.supabaseDb) return EIQ.supabaseDb;
    return localDb;
  }

  // Facade — sync session helpers + async data API
  EIQ.db = {
    get isSupabase() {
      return mode() === "supabase";
    },
    getSession() {
      return active().getSession();
    },
    setSession(s) {
      return active().setSession(s);
    },
    uuid: (...a) => active().uuid(...a),
    now: () => active().now(),
    ready: (...a) => active().ready(...a),
    status: (...a) => active().status(...a),
    hydrateFromAuth: (...a) => active().hydrateFromAuth(...a),
    registerUser: (...a) => active().registerUser(...a),
    verifyPassword: (...a) => active().verifyPassword(...a),
    signOut: (...a) => active().signOut(...a),
    getUser: (...a) => active().getUser(...a),
    findUserByEmail: (...a) => {
      const r = active().findUserByEmail(...a);
      return r && typeof r.then === "function" ? r : Promise.resolve(r);
    },
    enableMfa: (...a) => active().enableMfa(...a),
    verifyMfaCode: (...a) => active().verifyMfaCode(...a),
    createOrganization: (...a) => active().createOrganization(...a),
    updateOrganization: (...a) => active().updateOrganization(...a),
    membershipsForUser: (...a) => active().membershipsForUser(...a),
    getOrg: (...a) => active().getOrg(...a),
    getMembership: (...a) => active().getMembership(...a),
    scoped: (...a) => active().scoped(...a),
    membersOfOrg: (...a) => active().membersOfOrg(...a),
    inviteMember: (...a) => active().inviteMember(...a),
    recentAudit: (...a) => active().recentAudit(...a),
    stats: (...a) => active().stats(...a),
    wipeAll: (...a) => active().wipeAll(...a),
    listReceipts: (...a) => active().listReceipts(...a),
    createReceipt: (...a) => active().createReceipt(...a),
    deleteReceipt: (...a) => active().deleteReceipt(...a),
    listTasks: (...a) => active().listTasks(...a),
    createTask: (...a) => active().createTask(...a),
    updateTask: (...a) => active().updateTask(...a),
    deleteTask: (...a) => active().deleteTask(...a),
    invokeAi: (...a) => active().invokeAi(...a),
  };
})();
