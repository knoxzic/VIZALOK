/**
 * Expense IQ™ — Supabase multi-tenant data adapter
 * Same method surface as local db.js; all data methods are async.
 * Per-user isolation via Supabase Auth + RLS (org membership).
 */
(function () {
  window.EIQ = window.EIQ || {};

  function sessionKey() {
    return "eiq_session";
  }

  function now() {
    return new Date().toISOString();
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSb() {
    // Prefer BFF shared client (same project as rest of site)
    if (window.BFF && BFF.supabase && typeof BFF.supabase.getClient === "function") {
      const c = BFF.supabase.getClient();
      if (c) return c;
    }
    const createClient =
      (window.supabase && window.supabase.createClient) ||
      (window.supabaseJs && window.supabaseJs.createClient);
    const cfg =
      (EIQ.config && EIQ.config.supabase) ||
      (window.BFF && BFF.config && BFF.config.supabase) ||
      {};
    if (!createClient || !cfg.url || !cfg.anonKey) return null;
    if (!EIQ._sbClient) {
      EIQ._sbClient = createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          // Must match BFF.supabase client (single session)
          storageKey: "bff-supabase-auth",
        },
      });
    }
    return EIQ._sbClient;
  }

  function requireSb() {
    const sb = getSb();
    if (!sb) {
      throw new Error(
        "Supabase is not loaded. Check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY and CDN script."
      );
    }
    return sb;
  }

  function mapUser(row, authUser) {
    if (!row && !authUser) return null;
    return {
      user_id: (row && row.user_id) || (authUser && authUser.id),
      email: (row && row.email) || (authUser && authUser.email) || "",
      display_name:
        (row && row.display_name) ||
        (authUser && authUser.user_metadata && authUser.user_metadata.display_name) ||
        ((authUser && authUser.email) || "").split("@")[0],
      mfa_enabled: !!(row && row.mfa_enabled),
      mfa_secret: row ? row.mfa_secret : null,
      created_at: row ? row.created_at : null,
    };
  }

  async function ensureProfile(authUser) {
    const sb = requireSb();
    if (!authUser) return null;
    const { data: existing } = await sb
      .from("eiq_profiles")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (existing) return mapUser(existing, authUser);

    const display =
      (authUser.user_metadata && authUser.user_metadata.display_name) ||
      (authUser.email || "user").split("@")[0];
    const payload = {
      user_id: authUser.id,
      email: String(authUser.email || "").toLowerCase(),
      display_name: display,
      mfa_enabled: false,
    };
    const { data, error } = await sb
      .from("eiq_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();
    if (error) {
      // Trigger may have raced; re-read
      const { data: again } = await sb
        .from("eiq_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (again) return mapUser(again, authUser);
      console.warn("[EIQ] profile upsert", error.message);
      return mapUser(null, authUser);
    }
    return mapUser(data, authUser);
  }

  async function currentAuthUser() {
    const sb = requireSb();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  const db = {
    uuid,
    now,
    isSupabase: true,

    getSession() {
      try {
        return JSON.parse(sessionStorage.getItem(sessionKey()) || "null");
      } catch {
        return null;
      }
    },

    setSession(session) {
      if (!session) sessionStorage.removeItem(sessionKey());
      else sessionStorage.setItem(sessionKey(), JSON.stringify(session));
    },

    async ready() {
      try {
        requireSb();
        return true;
      } catch {
        return false;
      }
    },

    async status() {
      const sb = getSb();
      if (!sb) {
        return { ok: false, mode: "supabase", message: "Supabase client not available" };
      }
      const cfg =
        (window.BFF && BFF.config && BFF.config.supabase) ||
        (EIQ.config && EIQ.config.supabase) ||
        {};
      try {
        const { data, error } = await sb.auth.getSession();
        return {
          ok: !error,
          mode: "supabase",
          url: cfg.url || "",
          hasSession: !!(data && data.session),
          message: error ? error.message : "Connected",
        };
      } catch (e) {
        return { ok: false, mode: "supabase", message: e.message || "Connection failed" };
      }
    },

    async registerUser({ email, password, displayName }) {
      const sb = requireSb();
      const e = String(email || "")
        .trim()
        .toLowerCase();
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      const { data, error } = await sb.auth.signUp({
        email: e,
        password: String(password),
        options: {
          data: { display_name: (displayName || "").trim() || e.split("@")[0] },
        },
      });
      if (error) throw new Error(error.message || "Registration failed.");
      if (!data.user) throw new Error("Registration failed — no user returned.");

      // Email confirmation may leave session empty — still create profile row if session exists
      const user = await ensureProfile(data.user);
      if (!data.session) {
        throw new Error(
          "Account created. Check your email to confirm, then sign in. (If confirmations are off in Supabase Auth, try signing in now.)"
        );
      }
      return {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: false,
      };
    },

    async verifyPassword(email, password) {
      const sb = requireSb();
      const e = String(email || "")
        .trim()
        .toLowerCase();
      const { data, error } = await sb.auth.signInWithPassword({
        email: e,
        password: String(password),
      });
      if (error) {
        if (/invalid login/i.test(error.message)) return null;
        throw new Error(error.message || "Sign-in failed.");
      }
      if (!data.user) return null;
      const user = await ensureProfile(data.user);
      return {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: !!user.mfa_enabled,
      };
    },

    async signOut() {
      const sb = getSb();
      this.setSession(null);
      if (sb) await sb.auth.signOut();
    },

    async getUser(userId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return mapUser(data, null);
      const auth = await currentAuthUser();
      if (auth && auth.id === userId) return ensureProfile(auth);
      return null;
    },

    async findUserByEmail(email) {
      const sb = requireSb();
      const e = String(email || "")
        .trim()
        .toLowerCase();
      const { data, error } = await sb
        .from("eiq_profiles")
        .select("*")
        .eq("email", e)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapUser(data, null) : null;
    },

    async enableMfa(userId) {
      const sb = requireSb();
      const secret = String(Math.floor(100000 + Math.random() * 900000));
      const { error } = await sb
        .from("eiq_profiles")
        .update({ mfa_enabled: true, mfa_secret: secret })
        .eq("user_id", userId);
      if (error) throw new Error(error.message || "Could not enable MFA.");
      return secret;
    },

    async verifyMfaCode(userId, code) {
      const user = await this.getUser(userId);
      if (!user || !user.mfa_enabled) return false;
      // Prefer reading secret from DB (not exposed on map for all callers)
      const sb = requireSb();
      const { data } = await sb
        .from("eiq_profiles")
        .select("mfa_secret, mfa_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data || !data.mfa_enabled) return false;
      return String(code).trim() === String(data.mfa_secret);
    },

    async createOrganization({ orgName, orgType, coaTemplate, ein, fiscalYearStart, ownerUserId }) {
      const sb = requireSb();
      const { data, error } = await sb.rpc("eiq_create_organization", {
        p_org_name: orgName,
        p_org_type: orgType,
        p_coa_template: coaTemplate,
        p_ein: ein || "",
        p_fiscal_year_start: fiscalYearStart || null,
      });
      if (error) {
        // Fallback if RPC not applied yet — direct insert (may fail RLS until schema is run)
        if (/could not find the function|schema cache|function/i.test(error.message)) {
          const org_id = uuid();
          const org = {
            org_id,
            org_name: String(orgName || "").trim(),
            org_type: orgType,
            coa_template: coaTemplate,
            ein: (ein || "").trim(),
            fiscal_year_start: fiscalYearStart || new Date().toISOString().slice(0, 10),
            created_by: ownerUserId,
            created_at: now(),
          };
          const { error: e1 } = await sb.from("eiq_organizations").insert(org);
          if (e1) {
            throw new Error(
              e1.message +
                " — Run expense-iq/supabase/schema.sql in the Supabase SQL Editor, then retry."
            );
          }
          const { error: e2 } = await sb.from("eiq_org_members").insert({
            user_id: ownerUserId,
            org_id,
            role: "owner",
          });
          if (e2) throw new Error(e2.message);
          return org;
        }
        throw new Error(
          error.message +
            " — If tables are missing, run expense-iq/supabase/schema.sql in Supabase."
        );
      }
      // RPC may return a row object or array depending on version
      const org = Array.isArray(data) ? data[0] : data;
      return org;
    },

    async updateOrganization(orgId, patch, actorUserId) {
      const sb = requireSb();
      const payload = {
        org_name: patch.org_name,
        org_type: patch.org_type,
        coa_template: patch.coa_template,
        ein: patch.ein,
        fiscal_year_start: patch.fiscal_year_start,
        updated_at: now(),
      };
      const { data: before } = await sb
        .from("eiq_organizations")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      const { data, error } = await sb
        .from("eiq_organizations")
        .update(payload)
        .eq("org_id", orgId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message || "Update failed.");
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: actorUserId,
        action: "edit",
        entity_type: "organization",
        entity_id: orgId,
        before_value: before,
        after_value: data,
      });
      return data;
    },

    async membershipsForUser(userId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_org_members")
        .select(
          "org_id, role, eiq_organizations ( org_id, org_name, org_type, coa_template )"
        )
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data || [])
        .map((m) => {
          const org = m.eiq_organizations;
          if (!org) return null;
          return {
            org_id: m.org_id,
            role: m.role,
            org_name: org.org_name,
            org_type: org.org_type,
            coa_template: org.coa_template,
          };
        })
        .filter(Boolean);
    },

    async getOrg(orgId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_organizations")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async getMembership(userId, orgId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_org_members")
        .select("*")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async scoped(orgId, table) {
      if (!orgId) throw new Error("org_id is required — no unscoped queries.");
      const sb = requireSb();
      const map = {
        transactions: "eiq_transactions",
        receipts: "eiq_receipts",
        grants: "eiq_grants",
        mileage_trips: "eiq_mileage_trips",
        tasks: "eiq_tasks",
        chart_of_accounts: null,
      };
      const t = map[table];
      if (!t) return [];
      const { data, error } = await sb.from(t).select("*").eq("org_id", orgId);
      if (error) {
        console.warn("[EIQ] scoped", table, error.message);
        return [];
      }
      return data || [];
    },

    async membersOfOrg(orgId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_org_members")
        .select("user_id, role, eiq_profiles ( email, display_name, mfa_enabled )")
        .eq("org_id", orgId);
      if (error) {
        // Fallback without embed if FK relationship name differs
        const { data: mems, error: e2 } = await sb
          .from("eiq_org_members")
          .select("user_id, role")
          .eq("org_id", orgId);
        if (e2) throw new Error(e2.message);
        const out = [];
        for (const m of mems || []) {
          const u = await this.getUser(m.user_id);
          out.push({
            user_id: m.user_id,
            role: m.role,
            email: u ? u.email : "?",
            display_name: u ? u.display_name : "?",
            mfa_enabled: u ? !!u.mfa_enabled : false,
          });
        }
        return out;
      }
      return (data || []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        email: (m.eiq_profiles && m.eiq_profiles.email) || "?",
        display_name: (m.eiq_profiles && m.eiq_profiles.display_name) || "?",
        mfa_enabled: !!(m.eiq_profiles && m.eiq_profiles.mfa_enabled),
      }));
    },

    async inviteMember({ orgId, email, role, actorUserId }) {
      const sb = requireSb();
      const { error } = await sb.rpc("eiq_invite_member", {
        p_org_id: orgId,
        p_email: email,
        p_role: role,
      });
      if (error) {
        if (/could not find the function|schema cache|function/i.test(error.message)) {
          const target = await this.findUserByEmail(email);
          if (!target) {
            throw new Error(
              "User must register first. Ask them to create an Expense IQ account, then invite by email."
            );
          }
          const { error: e2 } = await sb.from("eiq_org_members").insert({
            user_id: target.user_id,
            org_id: orgId,
            role,
          });
          if (e2) throw new Error(e2.message);
          await sb.from("eiq_audit_log").insert({
            org_id: orgId,
            user_id: actorUserId,
            action: "permission_change",
            entity_type: "org_users",
            entity_id: target.user_id,
            after_value: { email, role },
          });
          return true;
        }
        throw new Error(error.message);
      }
      return true;
    },

    async recentAudit(orgId, limit) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_audit_log")
        .select("*")
        .eq("org_id", orgId)
        .order("timestamp", { ascending: false })
        .limit(limit || 20);
      if (error) {
        console.warn("[EIQ] audit", error.message);
        return [];
      }
      return data || [];
    },

    async stats(orgId) {
      const [transactions, receipts, grants, mileage] = await Promise.all([
        this.scoped(orgId, "transactions"),
        this.scoped(orgId, "receipts"),
        this.scoped(orgId, "grants"),
        this.scoped(orgId, "mileage_trips"),
      ]);
      return {
        transactions: transactions.length,
        receipts: receipts.length,
        grants: grants.length,
        mileage: mileage.length,
        posted: transactions.filter((t) => t.status === "posted").length,
      };
    },

    async wipeAll() {
      // Cloud mode: only clear local session + sign out — never mass-delete remote tenants
      await this.signOut();
    },

    async listReceipts(orgId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_receipts")
        .select("*")
        .eq("org_id", orgId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },

    async createReceipt(orgId, data, userId) {
      const sb = requireSb();
      const payload = {
        org_id: orgId,
        vendor: data.vendor || "Unknown",
        date: data.date || now().slice(0, 10),
        total: Number(data.total) || 0,
        category: data.category || "Uncategorized",
        items: Array.isArray(data.items) ? data.items : [],
        engine: data.engine || null,
        created_by: userId,
      };
      const { data: row, error } = await sb
        .from("eiq_receipts")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: userId,
        action: "create",
        entity_type: "receipt",
        entity_id: row ? row.id : null,
        after_value: { vendor: payload.vendor, total: payload.total },
      });
      return row;
    },

    async deleteReceipt(receiptId, orgId, userId) {
      const sb = requireSb();
      const { data: before } = await sb
        .from("eiq_receipts")
        .select("*")
        .eq("id", receiptId)
        .eq("org_id", orgId)
        .maybeSingle();
      const { error } = await sb
        .from("eiq_receipts")
        .delete()
        .eq("id", receiptId)
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: userId,
        action: "delete",
        entity_type: "receipt",
        entity_id: receiptId,
        before_value: before || null,
      });
      return true;
    },

    async listTasks(orgId) {
      const sb = requireSb();
      const { data, error } = await sb
        .from("eiq_tasks")
        .select("*")
        .eq("org_id", orgId)
        .order("date", { ascending: true, nullsFirst: false })
        .order("time", { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return data || [];
    },

    async createTask(orgId, data, userId) {
      const sb = requireSb();
      const payload = {
        org_id: orgId,
        type: data.type === "booking" ? "booking" : "task",
        title: data.title,
        date: data.date || null,
        time: data.time || null,
        notes: data.notes || "",
        created_by: userId,
      };
      const { data: row, error } = await sb
        .from("eiq_tasks")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: userId,
        action: "create",
        entity_type: "task",
        entity_id: row ? row.id : null,
        after_value: { type: payload.type, title: payload.title },
      });
      return row;
    },

    async updateTask(taskId, orgId, patch, userId) {
      const sb = requireSb();
      const { data: before } = await sb
        .from("eiq_tasks")
        .select("*")
        .eq("id", taskId)
        .eq("org_id", orgId)
        .maybeSingle();
      const payload = Object.assign({}, patch, { updated_at: now() });
      if ("date" in payload && !payload.date) payload.date = null;
      if ("time" in payload && !payload.time) payload.time = null;
      const { data, error } = await sb
        .from("eiq_tasks")
        .update(payload)
        .eq("id", taskId)
        .eq("org_id", orgId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: userId,
        action: "edit",
        entity_type: "task",
        entity_id: taskId,
        before_value: before || null,
        after_value: data,
      });
      return data;
    },

    async deleteTask(taskId, orgId, userId) {
      const sb = requireSb();
      const { data: before } = await sb
        .from("eiq_tasks")
        .select("*")
        .eq("id", taskId)
        .eq("org_id", orgId)
        .maybeSingle();
      const { error } = await sb.from("eiq_tasks").delete().eq("id", taskId).eq("org_id", orgId);
      if (error) throw new Error(error.message);
      await sb.from("eiq_audit_log").insert({
        org_id: orgId,
        user_id: userId,
        action: "delete",
        entity_type: "task",
        entity_id: taskId,
        before_value: before || null,
      });
      return true;
    },

    async invokeAi(action, payload) {
      const sb = requireSb();
      const { data, error } = await sb.functions.invoke("eiq-ai", {
        body: Object.assign({ action }, payload),
      });
      if (error) {
        let message = error.message || "AI request failed.";
        if (error.context && typeof error.context.json === "function") {
          try {
            const body = await error.context.json();
            if (body && body.error) message = body.error;
          } catch (_) {}
        }
        throw new Error(message);
      }
      if (data && data.error) throw new Error(data.error);
      return data;
    },

    /** Restore EIQ session from Supabase auth if local session missing */
    async hydrateFromAuth() {
      const sb = getSb();
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      if (!data.session || !data.session.user) return null;
      const user = await ensureProfile(data.session.user);
      const existing = this.getSession();
      if (existing && existing.user_id === user.user_id) return existing;
      this.setSession({
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        mfa_enabled: !!user.mfa_enabled,
        mfa_required: false,
        mfa_verified: true,
        org_id: null,
        role: null,
      });
      return this.getSession();
    },
  };

  EIQ.supabaseDb = db;
})();
