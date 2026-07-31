/**
 * Expense IQ™ — app shell (Phase 1)
 * Hash routes; every view reads session.org_id.
 */
(function () {
  const main = document.getElementById("main");
  const nav = document.getElementById("nav");
  const orgSwitch = document.getElementById("org-switch");
  const roleBadge = document.getElementById("role-badge");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");

  function session() {
    return EIQ.db.getSession();
  }

  function requireSession() {
    const s = session();
    if (!s || !s.user_id || !s.org_id) {
      window.location.href = "index.html";
      return null;
    }
    if (s.mfa_required && !s.mfa_verified) {
      window.location.href = "index.html";
      return null;
    }
    return s;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function route() {
    const hash = (location.hash || "#/dashboard").replace(/^#\/?/, "") || "dashboard";
    return hash.split("?")[0];
  }

  function buildNav(active) {
    nav.innerHTML = EIQ.config.nav
      .map((item) => {
        const isActive = item.id === active ? " is-active" : "";
        return `<a class="nav-link${isActive}" href="${item.href}">
          <span class="nav-link__icon">${item.icon}</span>
          ${escapeHtml(item.label)}
          <span class="nav-phase">P${item.phase}</span>
        </a>`;
      })
      .join("");
  }

  function refreshChrome() {
    const s = session();
    if (!s) return;
    roleBadge.textContent = s.role || "—";
    const memberships = EIQ.db.membershipsForUser(s.user_id);
    orgSwitch.innerHTML = memberships
      .map(
        (m) =>
          `<option value="${m.org_id}" ${m.org_id === s.org_id ? "selected" : ""}>${escapeHtml(
            m.org_name
          )} (${escapeHtml(m.role)})</option>`
      )
      .join("");
  }

  function placeholder(title, phase, blurb) {
    return `
      <div class="page-head">
        <h1>${escapeHtml(title)}</h1>
        <p><span class="badge badge--phase">Phase ${phase}</span> — shell only until that phase ships.</p>
      </div>
      <div class="panel placeholder-mod">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(blurb)}</p>
        <p style="margin-top:16px;font-size:13px">
          When this module posts money, it must go through the same Validation Gate → <code>transactions</code> + <code>coa_id</code> path. No shortcuts.
        </p>
      </div>`;
  }

  function viewDashboard(s) {
    const org = EIQ.db.getOrg(s.org_id);
    const stats = EIQ.db.stats(s.org_id);
    return `
      <div class="page-head">
        <h1>Executive Dashboard</h1>
        <p>Hello, ${escapeHtml(s.display_name)}. Org context: <strong>${escapeHtml(
      org.org_name
    )}</strong></p>
      </div>

      <div class="rule-banner">
        <strong>The one rule:</strong> every dollar, from any source, resolves to exactly one Ledger row
        mapped to exactly one Chart of Accounts code before it is posted.
      </div>

      <div class="grid-kpi">
        <div class="kpi"><div class="kpi__label">Income</div><div class="kpi__value">—</div><div class="kpi__hint">Phase 3 data</div></div>
        <div class="kpi"><div class="kpi__label">Expenses</div><div class="kpi__value">—</div><div class="kpi__hint">Phase 3 data</div></div>
        <div class="kpi"><div class="kpi__label">Net cash flow</div><div class="kpi__value">—</div><div class="kpi__hint">Phase 3 data</div></div>
        <div class="kpi"><div class="kpi__label">Missing receipts</div><div class="kpi__value">${stats.receipts}</div><div class="kpi__hint">Capture queue (P2)</div></div>
        <div class="kpi"><div class="kpi__label">Needs review</div><div class="kpi__value">0</div><div class="kpi__hint">Review queue (P2)</div></div>
        <div class="kpi"><div class="kpi__label">Mileage trips</div><div class="kpi__value">${stats.mileage}</div><div class="kpi__hint">Phase 4</div></div>
        <div class="kpi"><div class="kpi__label">Grant funds left</div><div class="kpi__value">—</div><div class="kpi__hint">Phase 4</div></div>
        <div class="kpi"><div class="kpi__label">Tax readiness</div><div class="kpi__value">—</div><div class="kpi__hint">Phase 5</div></div>
      </div>

      <div class="panel">
        <h2>Accuracy spine (from Unified Architecture Diagram)</h2>
        <div class="pipeline">
          <span class="pipeline__stage">1 Capture</span>
          <span class="pipeline__arrow">→</span>
          <span class="pipeline__stage">2 Extract / normalize</span>
          <span class="pipeline__arrow">→</span>
          <span class="pipeline__stage">3 Deduplicate</span>
          <span class="pipeline__arrow">→</span>
          <span class="pipeline__stage">4 Categorize</span>
          <span class="pipeline__arrow">→</span>
          <span class="pipeline__stage pipeline__stage--gate">5 Validation Gate</span>
          <span class="pipeline__arrow">→</span>
          <span class="pipeline__stage pipeline__stage--ledger">6 Post → Ledger</span>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0">
          Reports, dashboard tiles, and Gigi only <em>read</em> the Ledger. Posted transactions: <strong>${stats.posted}</strong>
          (of ${stats.transactions} total rows for this org).
        </p>
      </div>

      <div class="panel">
        <h2>Organization profile</h2>
        <table class="table">
          <tr><th>Field</th><th>Value</th></tr>
          <tr><td>org_id</td><td><code>${escapeHtml(org.org_id)}</code></td></tr>
          <tr><td>Type</td><td>${escapeHtml(org.org_type)}</td></tr>
          <tr><td>COA template</td><td><span class="badge">${escapeHtml(
            org.coa_template
          )}</span> ${org.coa_template === "smb" ? "→ Schedule C mapping" : "→ Form 990 functions"}</td></tr>
          <tr><td>Fiscal year start</td><td>${escapeHtml(org.fiscal_year_start)}</td></tr>
          <tr><td>EIN</td><td>${escapeHtml(org.ein || "—")}</td></tr>
          <tr><td>Your role</td><td><span class="badge badge--role">${escapeHtml(
            s.role
          )}</span></td></tr>
        </table>
      </div>

      <p class="footer-meta">Expense IQ ${escapeHtml(EIQ.config.version)} · Storage: ${escapeHtml(
      EIQ.config.STORAGE_MODE
    )} · ${escapeHtml(EIQ.config.brand)}</p>
    `;
  }

  function viewOrg(s) {
    if (!EIQ.permissions.can(s, "admin", "full") && s.role !== "owner" && s.role !== "bookkeeper") {
      // Bookkeeper can view; owner full — allow all members to view profile basics
    }
    const org = EIQ.db.getOrg(s.org_id);
    const canEdit = s.role === "owner";
    return `
      <div class="page-head">
        <h1>Organization</h1>
        <p>Profile and COA template. Scoped by <code>org_id</code>.</p>
      </div>
      <div class="panel">
        <form id="form-org-edit">
          <div class="field">
            <label>Organization name</label>
            <input name="org_name" value="${escapeHtml(org.org_name)}" ${canEdit ? "" : "readonly"} />
          </div>
          <div class="field">
            <label>Organization type</label>
            <select name="org_type" ${canEdit ? "" : "disabled"}>
              ${EIQ.config.orgTypes
                .map(
                  (t) =>
                    `<option value="${t.value}" ${t.value === org.org_type ? "selected" : ""}>${t.label}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Chart of Accounts template</label>
            <select name="coa_template" ${canEdit ? "" : "disabled"}>
              ${EIQ.config.coaTemplates
                .map(
                  (t) =>
                    `<option value="${t.value}" ${t.value === org.coa_template ? "selected" : ""}>${t.label}</option>`
                )
                .join("")}
            </select>
            <p class="field-hint">Changing template does not rewrite posted transactions (none yet). Full COA seed is Phase 3.</p>
          </div>
          <div class="field">
            <label>EIN</label>
            <input name="ein" value="${escapeHtml(org.ein || "")}" ${canEdit ? "" : "readonly"} />
          </div>
          <div class="field">
            <label>Fiscal year start</label>
            <input type="date" name="fiscal_year_start" value="${escapeHtml(
              org.fiscal_year_start || ""
            )}" ${canEdit ? "" : "readonly"} />
          </div>
          ${
            canEdit
              ? `<button class="btn btn--primary" type="submit">Save organization</button>`
              : `<div class="alert alert--info">Only the Owner can edit organization settings.</div>`
          }
        </form>
        <div id="org-save-msg" class="alert alert--ok hidden" style="margin-top:12px"></div>
      </div>
      <div class="panel">
        <h2>Create another organization</h2>
        <p style="font-size:14px;color:var(--muted)">Multi-org: same user, different <code>org_id</code> contexts. Use the top switcher after creating.</p>
        <a class="btn btn--ghost" href="index.html#new-org" id="link-new-org">+ New organization flow</a>
      </div>
    `;
  }

  function viewAdmin(s) {
    if (!EIQ.permissions.can(s, "admin", "full")) {
      return `
        <div class="page-head"><h1>Admin</h1></div>
        <div class="alert alert--error">Admin / Security is Owner-only (permission matrix §9.2).</div>`;
    }
    const members = EIQ.db.membersOfOrg(s.org_id);
    const audit = EIQ.db.recentAudit(s.org_id, 15);
    return `
      <div class="page-head">
        <h1>Admin &amp; Security</h1>
        <p>Roles, membership, audit trail. RBAC is enforced in code paths, not only hidden menus.</p>
      </div>
      <div class="panel">
        <h2>Members (org_users)</h2>
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>MFA</th></tr></thead>
          <tbody>
            ${members
              .map(
                (m) => `<tr>
                <td>${escapeHtml(m.display_name)}</td>
                <td>${escapeHtml(m.email)}</td>
                <td><span class="badge badge--role">${escapeHtml(m.role)}</span></td>
                <td>${m.mfa_enabled ? "On" : "Off"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Invite member (demo)</h2>
        <p class="field-hint" style="margin-top:0">User must already have registered in this browser (local store).</p>
        <form id="form-invite" class="stack-row">
          <div class="field" style="flex:1;min-width:180px;margin:0">
            <label>Email</label>
            <input name="email" type="email" required />
          </div>
          <div class="field" style="min-width:160px;margin:0">
            <label>Role</label>
            <select name="role">
              ${EIQ.config.roles
                .filter((r) => r !== "owner")
                .map((r) => `<option value="${r}">${r}</option>`)
                .join("")}
            </select>
          </div>
          <div style="align-self:flex-end">
            <button class="btn btn--primary" type="submit">Invite</button>
          </div>
        </form>
        <div id="invite-msg" class="alert hidden" style="margin-top:12px"></div>
      </div>
      <div class="panel">
        <h2>Permission matrix (scaffolding)</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Module</th>
              ${EIQ.config.roles.map((r) => `<th>${r.replace(/_/g, " ")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${Object.keys(EIQ.config.permissions)
              .map((mod) => {
                const row = EIQ.config.permissions[mod];
                return `<tr><td>${escapeHtml(mod)}</td>${EIQ.config.roles
                  .map((r) => `<td>${escapeHtml(row[r] || "—")}</td>`)
                  .join("")}</tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Audit log (immutable append)</h2>
        <table class="table">
          <thead><tr><th>When</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>
            ${
              audit.length
                ? audit
                    .map(
                      (a) => `<tr>
                      <td>${escapeHtml(a.timestamp)}</td>
                      <td>${escapeHtml(a.action)}</td>
                      <td>${escapeHtml(a.entity_type)} · ${escapeHtml(
                        String(a.entity_id || "").slice(0, 8)
                      )}…</td>
                    </tr>`
                    )
                    .join("")
                : `<tr><td colspan="3">No events yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Danger zone (local demo)</h2>
        <button type="button" class="btn btn--pink" id="btn-wipe">Wipe all local Expense IQ data</button>
      </div>
    `;
  }

  function render() {
    const s = requireSession();
    if (!s) return;
    refreshChrome();
    const r = route();
    buildNav(r);

    const map = {
      dashboard: () => viewDashboard(s),
      capture: () =>
        placeholder(
          "Capture",
          2,
          "Camera, upload, bulk, email-in → OCR & confidence scoring. Not built yet."
        ),
      transactions: () =>
        placeholder(
          "Transactions",
          3,
          "Register, imports, posting pipeline into the central Ledger."
        ),
      coa: () =>
        placeholder(
          "Chart of Accounts",
          3,
          "SMB and Nonprofit templates with Schedule C / Form 990 mapping."
        ),
      bank: () =>
        placeholder("Bank & Reconciliation", 3, "Match, categorize, period close / lock."),
      grants: () =>
        placeholder("Grants", 4, "Allowability, budget lines, burn rate — still posts via Ledger."),
      mileage: () =>
        placeholder(
          "Mileage & Travel",
          4,
          "Trips and travel lines costed and posted as transactions — not side logs."
        ),
      vendors: () => placeholder("Vendors", 4, "Directory, W-9 / 1099 thresholds."),
      clients: () => placeholder("Clients & Projects", 4, "Billable split and profitability."),
      tax: () => placeholder("Tax Center", 5, "Schedule C summary and tax packages."),
      reports: () =>
        placeholder(
          "Reports & Exports",
          5,
          "Read-only rollups off transactions only — never independent math."
        ),
      gigi: () =>
        placeholder(
          "Gigi Assistant",
          5,
          "Read-only financial Q&A. Separate from marketing-site Gigi on BFF."
        ),
      admin: () => viewAdmin(s),
      org: () => viewOrg(s),
    };

    main.innerHTML = (map[r] || map.dashboard)();
    wireViewHandlers(r, s);
    closeMenu();
  }

  function wireViewHandlers(r, s) {
    if (r === "org") {
      const form = document.getElementById("form-org-edit");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (s.role !== "owner") return;
          const fd = new FormData(form);
          EIQ.db.updateOrganization(
            s.org_id,
            {
              org_name: String(fd.get("org_name") || "").trim(),
              org_type: String(fd.get("org_type")),
              coa_template: String(fd.get("coa_template")),
              ein: String(fd.get("ein") || "").trim(),
              fiscal_year_start: String(fd.get("fiscal_year_start")),
            },
            s.user_id
          );
          const sess = session();
          sess.org_name = String(fd.get("org_name") || "").trim();
          EIQ.db.setSession(sess);
          const msg = document.getElementById("org-save-msg");
          msg.textContent = "Organization saved.";
          msg.classList.remove("hidden");
          refreshChrome();
        });
      }
      const link = document.getElementById("link-new-org");
      if (link) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          // Drop org context, keep user, open create flow
          const sess = session();
          EIQ.db.setSession({
            user_id: sess.user_id,
            email: sess.email,
            display_name: sess.display_name,
            mfa_enabled: sess.mfa_enabled,
            mfa_required: false,
            mfa_verified: true,
            org_id: null,
            role: null,
          });
          // Store flag so auth-flow opens create
          sessionStorage.setItem("eiq_force_new_org", "1");
          window.location.href = "index.html";
        });
      }
    }

    if (r === "admin") {
      const form = document.getElementById("form-invite");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const msg = document.getElementById("invite-msg");
          const fd = new FormData(form);
          try {
            EIQ.db.inviteMember({
              orgId: s.org_id,
              email: String(fd.get("email")),
              role: String(fd.get("role")),
              actorUserId: s.user_id,
            });
            msg.className = "alert alert--ok";
            msg.textContent = "Member added to this organization.";
            msg.classList.remove("hidden");
            render();
          } catch (err) {
            msg.className = "alert alert--error";
            msg.textContent = err.message || "Invite failed.";
            msg.classList.remove("hidden");
          }
        });
      }
      const wipe = document.getElementById("btn-wipe");
      if (wipe) {
        wipe.addEventListener("click", () => {
          if (
            confirm(
              "Delete ALL local Expense IQ users, orgs, and data on this browser? This cannot be undone."
            )
          ) {
            EIQ.db.wipeAll();
            window.location.href = "index.html";
          }
        });
      }
    }
  }

  function closeMenu() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  }

  orgSwitch.addEventListener("change", () => {
    const s = session();
    if (!s) return;
    const orgId = orgSwitch.value;
    const m = EIQ.db.membershipsForUser(s.user_id).find((x) => x.org_id === orgId);
    if (!m) return;
    const mfaRequired = EIQ.permissions.mfaRequiredForRole(m.role);
    EIQ.db.setSession({
      ...s,
      org_id: m.org_id,
      role: m.role,
      org_name: m.org_name,
      mfa_required: mfaRequired,
      mfa_verified: mfaRequired ? s.mfa_verified : true,
    });
    if (mfaRequired && !s.mfa_verified) {
      window.location.href = "index.html";
      return;
    }
    render();
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    EIQ.db.setSession(null);
    window.location.href = "index.html";
  });

  document.getElementById("menu-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    backdrop.classList.toggle("is-open");
  });
  backdrop.addEventListener("click", closeMenu);

  window.addEventListener("hashchange", render);

  // Boot
  if (requireSession()) render();
})();
