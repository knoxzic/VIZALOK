/**
 * Expense IQ™ — app shell (Phase 1+)
 * Hash routes; every view reads session.org_id. Async-safe for Supabase.
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
    if (s.mfa_required && !s.mfa_verified && EIQ.config.REQUIRE_DEMO_MFA) {
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
    const live = EIQ.config.nav.filter((i) => i.live);
    const soon = EIQ.config.nav.filter((i) => !i.live);
    const link = (item) => {
      const isActive = item.id === active ? " is-active" : "";
      const badge = item.live
        ? ""
        : `<span class="nav-phase" title="Coming soon">Soon</span>`;
      return `<a class="nav-link${isActive}" href="${item.href}">
          <span class="nav-link__icon">${item.icon}</span>
          ${escapeHtml(item.label)}
          ${badge}
        </a>`;
    };
    nav.innerHTML =
      live.map(link).join("") +
      (soon.length
        ? `<div class="nav-section-label" style="margin-top:12px">Coming soon</div>` +
          soon.map(link).join("")
        : "");
  }

  async function refreshChrome() {
    const s = session();
    if (!s) return;
    roleBadge.textContent = s.role || "—";
    const memberships = await EIQ.db.membershipsForUser(s.user_id);
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
        <p><span class="badge badge--phase">Coming soon</span></p>
      </div>
      <div class="panel placeholder-mod">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(blurb)}</p>
        <p style="margin-top:16px;font-size:13px">
          This workspace module is not live yet. When it posts money, every dollar will still pass the Validation Gate → <code>transactions</code> + <code>coa_id</code>. No shortcuts.
        </p>
      </div>`;
  }

  async function viewDashboard(s) {
    const org = await EIQ.db.getOrg(s.org_id);
    const stats = await EIQ.db.stats(s.org_id);
    if (!org) {
      return `<div class="alert alert--error">Organization not found. <a href="index.html">Sign in again</a>.</div>`;
    }
    const [receipts, tasks] = await Promise.all([
      EIQ.db.listReceipts(s.org_id),
      EIQ.db.listTasks(s.org_id),
    ]);
    const nowDate = new Date();
    const monthTotal = receipts
      .filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date + "T00:00:00");
        return d.getMonth() === nowDate.getMonth() && d.getFullYear() === nowDate.getFullYear();
      })
      .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const upcomingBookings = tasks.filter((t) => t.type === "booking" && !t.done).length;
    const openTasks = tasks.filter((t) => t.type === "task" && !t.done).length;
    const recent = [
      ...receipts.map((r) => ({
        when: r.date || "",
        msg: `Receipt — ${r.vendor || "Unknown"} ($${(Number(r.total) || 0).toFixed(2)})`,
      })),
      ...tasks.map((t) => ({
        when: t.date || "",
        msg: `${t.type === "booking" ? "Booking" : "Task"} — ${t.title}`,
      })),
    ]
      .sort((a, b) => (b.when || "").localeCompare(a.when || ""))
      .slice(0, 8);

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
        <div class="kpi"><div class="kpi__label">Spent this month</div><div class="kpi__value">$${monthTotal.toFixed(
          2
        )}</div><div class="kpi__hint">Live · from Capture</div></div>
        <div class="kpi"><div class="kpi__label">Receipts logged</div><div class="kpi__value">${
          receipts.length
        }</div><div class="kpi__hint">Live count</div></div>
        <div class="kpi"><div class="kpi__label">Upcoming bookings</div><div class="kpi__value">${upcomingBookings}</div><div class="kpi__hint">Live count</div></div>
        <div class="kpi"><div class="kpi__label">Open tasks</div><div class="kpi__value">${openTasks}</div><div class="kpi__hint">Live count</div></div>
      </div>

      <div class="panel">
        <h2>Recent activity</h2>
        <p class="field-hint" style="margin:0 0 10px">Latest captures and ledger entries.</p>
        ${
          recent.length
            ? recent
                .map(
                  (r) => `<div class="receipt-row"><span>${escapeHtml(r.msg)}</span><span class="field-hint" style="margin:0">${escapeHtml(
                    r.when || "—"
                  )}</span></div>`
                )
                .join("")
            : `<p class="field-hint" style="margin:0">Nothing yet — try Capture or Bookings &amp; Tasks.</p>`
        }
      </div>

      <div class="nav-section-label" style="padding-left:0">Ledger rollups (Phase 3+)</div>
      <div class="grid-kpi">
        <div class="kpi"><div class="kpi__label">Income</div><div class="kpi__value">—</div><div class="kpi__hint">Coming soon</div></div>
        <div class="kpi"><div class="kpi__label">Expenses</div><div class="kpi__value">—</div><div class="kpi__hint">Coming soon</div></div>
        <div class="kpi"><div class="kpi__label">Net cash flow</div><div class="kpi__value">—</div><div class="kpi__hint">Coming soon</div></div>
        <div class="kpi"><div class="kpi__label">Needs review</div><div class="kpi__value">0</div><div class="kpi__hint">Coming soon</div></div>
        <div class="kpi"><div class="kpi__label">Mileage trips</div><div class="kpi__value">${stats.mileage}</div><div class="kpi__hint">Live count</div></div>
        <div class="kpi"><div class="kpi__label">Grant funds left</div><div class="kpi__value">—</div><div class="kpi__hint">Coming soon</div></div>
        <div class="kpi"><div class="kpi__label">Tax readiness</div><div class="kpi__value">—</div><div class="kpi__hint">Coming soon</div></div>
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
          <tr><td>Database</td><td><span class="badge">${escapeHtml(
            EIQ.config.STORAGE_MODE
          )}</span> · per-user org data via Supabase RLS</td></tr>
        </table>
      </div>

      <p class="footer-meta">Expense IQ ${escapeHtml(EIQ.config.version)} · Storage: ${escapeHtml(
      EIQ.config.STORAGE_MODE
    )} · ${escapeHtml(EIQ.config.brand)}</p>
    `;
  }

  let captureEngine = "local";
  let captureImage = null;
  let captureFlash = null;

  async function viewCapture(s) {
    const canWrite = EIQ.permissions.can(s, "receipts", "own");
    const flash = captureFlash;
    captureFlash = null;
    return `
      <div class="page-head">
        <h1>Capture</h1>
        <p>Photograph or upload a receipt. Local OCR needs no key; Grok gives richer extraction.</p>
      </div>
      ${flash ? `<div class="alert alert--${flash.type}">${escapeHtml(flash.msg)}</div>` : ""}
      ${
        canWrite
          ? `
      <div class="seg-toggle" id="engine-toggle">
        <button type="button" id="eng-local" class="${captureEngine === "local" ? "is-active" : ""}">Local OCR (offline, no key)</button>
        <button type="button" id="eng-grok" class="${captureEngine === "grok" ? "is-active" : ""}">Grok (AI vision)</button>
      </div>

      <div class="scan-zone" id="scan-zone">
        <img id="capture-preview" class="scan-zone__preview" style="display:none">
        <p id="scan-hint" class="field-hint">Local OCR reads raw text on-device — no account needed, works offline after the page loads. Grok reads vendor, date, total &amp; line items automatically via the eiq-ai server function.</p>
        <input type="file" id="capture-file" accept="image/*" capture="environment" class="hidden">
        <button type="button" class="btn btn--primary" id="scan-btn">📷 Scan Receipt</button>
        <div id="extract-row" class="stack-row hidden" style="margin-top:10px">
          <button type="button" class="btn btn--gold" id="extract-btn">Extract Details</button>
          <button type="button" class="btn btn--ghost" id="retake-btn">Retake</button>
        </div>
      </div>

      <div id="draft-form" class="panel hidden">
        <div class="field"><label>Vendor</label><input type="text" id="d-vendor"></div>
        <div class="stack-row">
          <div class="field" style="flex:1;min-width:140px"><label>Date</label><input type="date" id="d-date"></div>
          <div class="field" style="flex:1;min-width:140px"><label>Total</label><input type="text" id="d-total" inputmode="decimal"></div>
        </div>
        <div class="field"><label>Category</label><input type="text" id="d-category" placeholder="e.g. Office Supplies, Travel, Meals"></div>
        <div class="field"><label>Items (one per line — name — amount)</label><textarea id="d-items" style="min-height:70px"></textarea></div>
        <div id="draft-status" class="hidden"></div>
        <button type="button" class="btn btn--primary" id="save-receipt-btn">Save Receipt</button>
      </div>
      `
          : `<div class="alert alert--info">Your role can view receipts but not capture new ones.</div>`
      }
    `;
  }

  async function viewTransactions(s) {
    const receipts = await EIQ.db.listReceipts(s.org_id);
    const canWrite = EIQ.permissions.can(s, "receipts", "own");
    return `
      <div class="page-head">
        <h1>Transactions</h1>
        <p>Everything captured, in one ledger. Free-text category for now — Chart of Accounts posting is Phase 3.</p>
      </div>
      <div class="panel" style="overflow-x:auto">
        ${
          receipts.length
            ? `<table class="table">
          <thead><tr><th>Vendor</th><th>Date</th><th>Category</th><th style="text-align:right">Amount</th><th></th></tr></thead>
          <tbody>
            ${receipts
              .map(
                (r) => `<tr>
              <td>${escapeHtml(r.vendor)}</td>
              <td>${escapeHtml(r.date || "—")}</td>
              <td>${escapeHtml(r.category || "Uncategorized")}</td>
              <td style="text-align:right;font-weight:700">$${(Number(r.total) || 0).toFixed(2)}</td>
              <td>${
                canWrite
                  ? `<button type="button" class="del-link" data-del-receipt="${r.id}">Delete</button>`
                  : ""
              }</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>`
            : `<p class="field-hint" style="margin:0">No transactions yet — capture a receipt first.</p>`
        }
      </div>
    `;
  }

  let bookingsTaskType = "task";

  async function viewBookings(s) {
    const tasks = await EIQ.db.listTasks(s.org_id);
    const canWrite = EIQ.permissions.can(s, "tasks", "own");
    const groups = {};
    tasks.forEach((t) => {
      const key = t.date || "No date";
      (groups[key] = groups[key] || []).push(t);
    });
    const keys = Object.keys(groups).sort(
      (a, b) => (a === "No date") - (b === "No date") || a.localeCompare(b)
    );
    return `
      <div class="page-head">
        <h1>Bookings &amp; Tasks</h1>
        <p>Not part of the ledger pipeline — a home for to-dos and appointments alongside the books.</p>
      </div>
      ${
        canWrite
          ? `
      <div class="panel">
        <div class="seg-toggle" id="type-toggle">
          <button type="button" id="type-task" class="${bookingsTaskType === "task" ? "is-active" : ""}">Task</button>
          <button type="button" id="type-booking" class="${bookingsTaskType === "booking" ? "is-active" : ""}">Booking</button>
        </div>
        <div class="field"><label>Title</label><input type="text" id="t-title" placeholder="e.g. Call the dentist"></div>
        <div class="stack-row">
          <div class="field" style="flex:1;min-width:140px"><label>Date</label><input type="date" id="t-date"></div>
          <div class="field" style="flex:1;min-width:140px"><label>Time</label><input type="time" id="t-time"></div>
        </div>
        <div class="field"><label>Notes</label><textarea id="t-notes" style="min-height:50px"></textarea></div>
        <div id="task-status" class="hidden"></div>
        <button type="button" class="btn btn--primary" id="save-task-btn">Add</button>
        <button type="button" class="btn btn--ghost" id="quick-add-btn" style="margin-left:8px">Describe it in one line (Grok) →</button>
      </div>
      `
          : ""
      }
      <div id="task-lists">
        ${
          keys.length
            ? keys
                .map(
                  (date) => `
          <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin:16px 0 8px">${
            date === "No date" ? "No date" : escapeHtml(date)
          }</h3>
          ${groups[date]
            .map(
              (t) => `
            <div class="task-item ${t.type === "booking" ? "is-booking" : ""} ${t.done ? "is-done" : ""}">
              <input type="checkbox" ${t.done ? "checked" : ""} ${
                canWrite ? `data-toggle-task="${t.id}"` : "disabled"
              } style="margin-top:3px">
              <div class="content">
                <div class="t-title">${escapeHtml(t.title)}</div>
                <div class="t-meta">${t.type === "booking" ? "Booking" : "Task"}${t.time ? " · " + escapeHtml(String(t.time).slice(0, 5)) : ""}</div>
                ${t.notes ? `<div class="t-meta">${escapeHtml(t.notes)}</div>` : ""}
              </div>
              ${canWrite ? `<button type="button" class="del-link" data-del-task="${t.id}">✕</button>` : ""}
            </div>`
            )
            .join("")}
        `
                )
                .join("")
            : `<p class="field-hint">Nothing on the ledger yet.</p>`
        }
      </div>

      <div class="quick-add-backdrop hidden" id="quick-add-backdrop"></div>
      <div class="quick-add-drawer" id="quick-add-drawer">
        <button type="button" class="icon-btn" id="quick-add-close" style="position:absolute;top:14px;right:14px">✕</button>
        <h2>Quick add</h2>
        <p class="field-hint">Type it plainly — Grok fills in the title, date and time.</p>
        <div class="field"><textarea id="quick-add-text" placeholder="Book a dentist appointment next Tuesday afternoon" style="min-height:60px"></textarea></div>
        <div id="quick-add-status" class="hidden"></div>
        <button type="button" class="btn btn--gold" id="quick-add-parse-btn">Parse with Grok</button>
      </div>
    `;
  }

  async function viewOrg(s) {
    const org = await EIQ.db.getOrg(s.org_id);
    if (!org) {
      return `<div class="alert alert--error">Organization not found.</div>`;
    }
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

  async function viewAdmin(s) {
    if (!EIQ.permissions.can(s, "admin", "full")) {
      return `
        <div class="page-head"><h1>Admin</h1></div>
        <div class="alert alert--error">Admin / Security is Owner-only (permission matrix §9.2).</div>`;
    }
    const members = await EIQ.db.membersOfOrg(s.org_id);
    const audit = await EIQ.db.recentAudit(s.org_id, 15);
    const cloud = EIQ.db.isSupabase;
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
        <h2>Invite member</h2>
        <p class="field-hint" style="margin-top:0">${
          cloud
            ? "Invitee must already have registered an Expense IQ account (Supabase Auth)."
            : "User must already have registered in this browser (local store)."
        }</p>
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
        <h2>Session</h2>
        <p class="field-hint">Sign out clears this device session. Organization data stays in Supabase.</p>
        <button type="button" class="btn btn--ghost" id="btn-wipe">Sign out on this device</button>
      </div>
    `;
  }

  async function render() {
    const s = requireSession();
    if (!s) return;
    await refreshChrome();
    const r = route();
    buildNav(r);

    const map = {
      dashboard: () => viewDashboard(s),
      capture: () => viewCapture(s),
      transactions: () => viewTransactions(s),
      bookings: () => viewBookings(s),
      coa: () =>
        Promise.resolve(
          placeholder(
            "Chart of Accounts",
            3,
            "Coming soon — SMB and Nonprofit templates with Schedule C / Form 990 mapping."
          )
        ),
      bank: () =>
        Promise.resolve(
          placeholder(
            "Bank & Reconciliation",
            3,
            "Coming soon — match, categorize, and period close."
          )
        ),
      grants: () =>
        Promise.resolve(
          placeholder(
            "Grants",
            4,
            "Coming soon — allowability, budget lines, burn rate (still posts via Ledger)."
          )
        ),
      mileage: () =>
        Promise.resolve(
          placeholder("Mileage & Travel", 4, "Coming soon — trips costed and posted as transactions.")
        ),
      vendors: () =>
        Promise.resolve(
          placeholder("Vendors", 4, "Coming soon — directory, W-9 / 1099 thresholds.")
        ),
      clients: () =>
        Promise.resolve(
          placeholder("Clients & Projects", 4, "Coming soon — billable split and profitability.")
        ),
      tax: () =>
        Promise.resolve(
          placeholder("Tax Center", 5, "Coming soon — Schedule C summary and tax packages.")
        ),
      reports: () =>
        Promise.resolve(
          placeholder("Reports & Exports", 5, "Coming soon — read-only rollups from the Ledger only.")
        ),
      gigi: () =>
        Promise.resolve(
          placeholder("Gigi Assistant", 5, "Coming soon — read-only financial Q&A inside Expense IQ.")
        ),
      admin: () => viewAdmin(s),
      org: () => viewOrg(s),
    };

    try {
      main.innerHTML = await (map[r] || map.dashboard)();
    } catch (err) {
      main.innerHTML = `<div class="alert alert--error">${escapeHtml(
        err.message || "Failed to load view"
      )}</div>`;
    }
    wireViewHandlers(r, s);
    closeMenu();
  }

  function wireViewHandlers(r, s) {
    if (r === "capture") {
      const engineToggle = document.getElementById("engine-toggle");
      if (engineToggle) {
        engineToggle.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            captureEngine = btn.id === "eng-grok" ? "grok" : "local";
            engineToggle
              .querySelectorAll("button")
              .forEach((b) => b.classList.toggle("is-active", b === btn));
          });
        });
      }

      const fileInput = document.getElementById("capture-file");
      const scanBtn = document.getElementById("scan-btn");
      const preview = document.getElementById("capture-preview");
      const scanHint = document.getElementById("scan-hint");
      const extractRow = document.getElementById("extract-row");
      const draftForm = document.getElementById("draft-form");

      if (scanBtn && fileInput) scanBtn.addEventListener("click", () => fileInput.click());

      function resetScanUi() {
        captureImage = null;
        if (preview) {
          preview.style.display = "none";
          preview.removeAttribute("src");
        }
        if (scanHint) scanHint.style.display = "block";
        if (scanBtn) scanBtn.style.display = "inline-flex";
        if (extractRow) extractRow.classList.add("hidden");
        if (draftForm) draftForm.classList.add("hidden");
        if (fileInput) fileInput.value = "";
      }

      if (fileInput) {
        fileInput.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            captureImage = reader.result;
            if (preview) {
              preview.src = captureImage;
              preview.style.display = "block";
            }
            if (scanHint) scanHint.style.display = "none";
            if (scanBtn) scanBtn.style.display = "none";
            if (extractRow) extractRow.classList.remove("hidden");
          };
          reader.readAsDataURL(file);
        });
      }

      const retakeBtn = document.getElementById("retake-btn");
      if (retakeBtn) retakeBtn.addEventListener("click", resetScanUi);

      const extractBtn = document.getElementById("extract-btn");
      if (extractBtn) {
        extractBtn.addEventListener("click", async () => {
          if (!captureImage) return;
          const original = extractBtn.textContent;
          extractBtn.disabled = true;
          extractBtn.innerHTML = '<span class="spinner"></span>Reading receipt…';
          try {
            const parsed =
              captureEngine === "local"
                ? await EIQ.ocr.localExtract(captureImage)
                : await EIQ.db.invokeAi("extract_receipt", { orgId: s.org_id, image: captureImage });
            document.getElementById("d-vendor").value = parsed.vendor || "";
            document.getElementById("d-date").value =
              parsed.date || new Date().toISOString().slice(0, 10);
            document.getElementById("d-total").value = parsed.total ?? "";
            document.getElementById("d-category").value = parsed.category || "";
            document.getElementById("d-items").value = (parsed.items || [])
              .map((i) => `${i.name} — ${i.amount}`)
              .join("\n");
            if (draftForm) {
              draftForm.classList.remove("hidden");
              draftForm.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (err) {
            alert(err.message || "Extraction failed.");
          } finally {
            extractBtn.disabled = false;
            extractBtn.textContent = original;
          }
        });
      }

      const saveBtn = document.getElementById("save-receipt-btn");
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const vendor = document.getElementById("d-vendor").value.trim() || "Unknown";
          const date =
            document.getElementById("d-date").value || new Date().toISOString().slice(0, 10);
          const total = parseFloat(document.getElementById("d-total").value) || 0;
          const category = document.getElementById("d-category").value.trim() || "Uncategorized";
          const items = document
            .getElementById("d-items")
            .value.split("\n")
            .filter(Boolean)
            .map((line) => {
              const [name, amt] = line.split("—").map((x) => x && x.trim());
              return { name: name || line, amount: parseFloat(amt) || 0 };
            });
          try {
            await EIQ.db.createReceipt(
              s.org_id,
              { vendor, date, total, category, items, engine: captureEngine },
              s.user_id
            );
            captureFlash = { type: "ok", msg: `Saved — ${vendor} ($${total.toFixed(2)})` };
            captureImage = null;
            await render();
          } catch (err) {
            const statusEl = document.getElementById("draft-status");
            if (statusEl) {
              statusEl.className = "alert alert--error";
              statusEl.textContent = err.message || "Save failed.";
              statusEl.classList.remove("hidden");
            } else {
              alert(err.message || "Save failed.");
            }
          }
        });
      }
    }

    if (r === "transactions") {
      document.querySelectorAll("[data-del-receipt]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this receipt?")) return;
          try {
            await EIQ.db.deleteReceipt(btn.getAttribute("data-del-receipt"), s.org_id, s.user_id);
            await render();
          } catch (err) {
            alert(err.message || "Delete failed.");
          }
        });
      });
    }

    if (r === "bookings") {
      const typeToggle = document.getElementById("type-toggle");
      if (typeToggle) {
        typeToggle.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            bookingsTaskType = btn.id === "type-booking" ? "booking" : "task";
            typeToggle
              .querySelectorAll("button")
              .forEach((b) => b.classList.toggle("is-active", b === btn));
          });
        });
      }

      const saveTaskBtn = document.getElementById("save-task-btn");
      if (saveTaskBtn) {
        saveTaskBtn.addEventListener("click", async () => {
          const title = document.getElementById("t-title").value.trim();
          if (!title) {
            alert("Give it a title.");
            return;
          }
          const date = document.getElementById("t-date").value;
          const time = document.getElementById("t-time").value;
          const notes = document.getElementById("t-notes").value.trim();
          try {
            await EIQ.db.createTask(
              s.org_id,
              { type: bookingsTaskType, title, date, time, notes },
              s.user_id
            );
            await render();
          } catch (err) {
            const statusEl = document.getElementById("task-status");
            if (statusEl) {
              statusEl.className = "alert alert--error";
              statusEl.textContent = err.message || "Save failed.";
              statusEl.classList.remove("hidden");
            } else {
              alert(err.message || "Save failed.");
            }
          }
        });
      }

      document.querySelectorAll("[data-toggle-task]").forEach((cb) => {
        cb.addEventListener("change", async () => {
          try {
            await EIQ.db.updateTask(
              cb.getAttribute("data-toggle-task"),
              s.org_id,
              { done: cb.checked },
              s.user_id
            );
            await render();
          } catch (err) {
            alert(err.message || "Update failed.");
          }
        });
      });

      document.querySelectorAll("[data-del-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await EIQ.db.deleteTask(btn.getAttribute("data-del-task"), s.org_id, s.user_id);
            await render();
          } catch (err) {
            alert(err.message || "Delete failed.");
          }
        });
      });

      const quickBackdrop = document.getElementById("quick-add-backdrop");
      const quickDrawer = document.getElementById("quick-add-drawer");
      const openQuick = () => {
        if (quickBackdrop) quickBackdrop.classList.remove("hidden");
        if (quickDrawer) quickDrawer.classList.add("is-open");
      };
      const closeQuick = () => {
        if (quickBackdrop) quickBackdrop.classList.add("hidden");
        if (quickDrawer) quickDrawer.classList.remove("is-open");
      };
      const quickBtn = document.getElementById("quick-add-btn");
      if (quickBtn) quickBtn.addEventListener("click", openQuick);
      const quickClose = document.getElementById("quick-add-close");
      if (quickClose) quickClose.addEventListener("click", closeQuick);
      if (quickBackdrop) quickBackdrop.addEventListener("click", closeQuick);

      const parseBtn = document.getElementById("quick-add-parse-btn");
      if (parseBtn) {
        parseBtn.addEventListener("click", async () => {
          const textEl = document.getElementById("quick-add-text");
          const text = textEl.value.trim();
          if (!text) return;
          const original = parseBtn.textContent;
          parseBtn.disabled = true;
          parseBtn.innerHTML = '<span class="spinner"></span>Parsing…';
          try {
            const parsed = await EIQ.db.invokeAi("quick_add_task", { orgId: s.org_id, text });
            await EIQ.db.createTask(
              s.org_id,
              {
                type: parsed.type === "booking" ? "booking" : "task",
                title: parsed.title || text,
                date: parsed.date || "",
                time: parsed.time || "",
                notes: parsed.notes || "",
              },
              s.user_id
            );
            textEl.value = "";
            closeQuick();
            await render();
          } catch (err) {
            const statusEl = document.getElementById("quick-add-status");
            if (statusEl) {
              statusEl.className = "alert alert--error";
              statusEl.textContent = err.message || "Parse failed.";
              statusEl.classList.remove("hidden");
            } else {
              alert(err.message || "Parse failed.");
            }
          } finally {
            parseBtn.disabled = false;
            parseBtn.textContent = original;
          }
        });
      }
    }

    if (r === "org") {
      const form = document.getElementById("form-org-edit");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (s.role !== "owner") return;
          const fd = new FormData(form);
          try {
            await EIQ.db.updateOrganization(
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
            msg.textContent = "Organization saved to Supabase.";
            msg.classList.remove("hidden");
            await refreshChrome();
          } catch (err) {
            const msg = document.getElementById("org-save-msg");
            msg.className = "alert alert--error";
            msg.textContent = err.message || "Save failed.";
            msg.classList.remove("hidden");
          }
        });
      }
      const link = document.getElementById("link-new-org");
      if (link) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
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
          sessionStorage.setItem("eiq_force_new_org", "1");
          window.location.href = "index.html";
        });
      }
    }

    if (r === "admin") {
      const form = document.getElementById("form-invite");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const msg = document.getElementById("invite-msg");
          const fd = new FormData(form);
          try {
            await EIQ.db.inviteMember({
              orgId: s.org_id,
              email: String(fd.get("email")),
              role: String(fd.get("role")),
              actorUserId: s.user_id,
            });
            msg.className = "alert alert--ok";
            msg.textContent = "Member added to this organization.";
            msg.classList.remove("hidden");
            await render();
          } catch (err) {
            msg.className = "alert alert--error";
            msg.textContent = err.message || "Invite failed.";
            msg.classList.remove("hidden");
          }
        });
      }
      const wipe = document.getElementById("btn-wipe");
      if (wipe) {
        wipe.addEventListener("click", async () => {
          const cloud = EIQ.db.isSupabase;
          if (
            confirm(
              cloud
                ? "Sign out on this device? Cloud org data is kept in Supabase."
                : "Delete ALL local Expense IQ users, orgs, and data on this browser? This cannot be undone."
            )
          ) {
            await EIQ.db.wipeAll();
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

  orgSwitch.addEventListener("change", async () => {
    const s = session();
    if (!s) return;
    const orgId = orgSwitch.value;
    const memberships = await EIQ.db.membershipsForUser(s.user_id);
    const m = memberships.find((x) => x.org_id === orgId);
    if (!m) return;
    const mfaRequired =
      EIQ.config.REQUIRE_DEMO_MFA && EIQ.permissions.mfaRequiredForRole(m.role);
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
    await render();
  });

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await EIQ.db.signOut();
    if (window.BFF && BFF.auth) await BFF.auth.signOut();
    window.location.href = "../pages/auth.html";
  });

  document.getElementById("menu-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    backdrop.classList.toggle("is-open");
  });
  backdrop.addEventListener("click", closeMenu);

  window.addEventListener("hashchange", () => {
    render();
  });

  async function boot() {
    if (window.BFF && BFF.config && BFF.config.supabase) {
      EIQ.config.supabase = Object.assign({}, EIQ.config.supabase, BFF.config.supabase);
    }

    // Hard gate: confirmed email + product access (redirects if not)
    if (window.BFF && BFF.access) {
      const gate = await BFF.access.requireProduct("expense_iq", {
        next: window.location.href,
      });
      if (!gate) return;
    } else if (window.BFF && BFF.auth) {
      const auth = await BFF.auth.requireConfirmedUser({ next: window.location.href });
      if (!auth) return;
    }

    // Device lease: online issue_device_lease / offline signed cache
    if (window.BFF && BFF.deviceLease) {
      const lease = await BFF.deviceLease.gate({ hard: true });
      if (!lease.allowed) return;
    }

    if (EIQ.db.isSupabase) {
      try {
        await EIQ.db.hydrateFromAuth();
      } catch (_) {}
    }
    if (requireSession()) await render();
  }

  boot();
})();
