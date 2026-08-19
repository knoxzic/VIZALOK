/**
 * BFF staff lead dashboard — client guard + Supabase RLS.
 * Static HTML cannot hide files; policies must deny non-staff SELECT.
 */
(function () {
  const gate = document.getElementById("admin-gate");
  const app = document.getElementById("admin-app");
  let leads = [];
  let selectedId = null;

  function sb() {
    return window.BFF && BFF.supabase && BFF.supabase.getClient
      ? BFF.supabase.getClient()
      : null;
  }

  async function requireStaff() {
    const client = sb();
    if (!client) {
      gate.textContent = "Supabase not configured. Check js/config.js / env.";
      return null;
    }

    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) {
      gate.innerHTML =
        'Not signed in. <a href="../pages/auth.html">Sign in</a> with a staff account, then return here.';
      return null;
    }

    // Role check via profiles (if table/policy missing, still try leads read)
    let role = "unknown";
    try {
      const { data: prof } = await client
        .from("profiles")
        .select("role, display_name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (prof && prof.role) role = prof.role;
    } catch (e) {
      console.warn("[admin] profiles lookup", e);
    }

    if (role !== "admin" && role !== "staff" && role !== "unknown") {
      gate.textContent =
        "Access denied. Your profile role is “" + role + "”. Need staff/admin.";
      return null;
    }

    if (role === "unknown") {
      gate.textContent =
        "Signed in as " +
        session.user.email +
        ". No profiles.role yet — attempting lead read (run supabase/profiles_admin_leads.sql and set role=admin).";
    } else {
      gate.textContent = "Signed in as " + session.user.email + " (" + role + ")";
    }

    app.hidden = false;
    return client;
  }

  function renderTable(rows) {
    const body = document.getElementById("leads-body");
    if (!rows.length) {
      body.innerHTML = "<tr><td colspan='5'>No leads found (or RLS blocked SELECT).</td></tr>";
      return;
    }
    body.innerHTML = rows
      .map(function (r) {
        const d = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
        const notes = (r.notes || "").slice(0, 80);
        const stage = r.stage || r.status || "new";
        return (
          "<tr data-id='" +
          r.id +
          "'>" +
          "<td>" +
          d +
          "</td>" +
          "<td>" +
          escapeHtml(r.contact_name || "") +
          "</td>" +
          "<td>" +
          escapeHtml(r.email || "") +
          "</td>" +
          "<td>" +
          escapeHtml(stage) +
          "</td>" +
          "<td>" +
          escapeHtml(notes) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    body.querySelectorAll("tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openDetail(tr.getAttribute("data-id"));
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

  function applyFilters() {
    const q = (document.getElementById("filter-q").value || "").toLowerCase();
    const stage = document.getElementById("filter-stage").value;
    let rows = leads.slice();
    if (q) {
      rows = rows.filter(function (r) {
        return (
          (r.contact_name || "").toLowerCase().indexOf(q) >= 0 ||
          (r.email || "").toLowerCase().indexOf(q) >= 0 ||
          (r.notes || "").toLowerCase().indexOf(q) >= 0
        );
      });
    }
    if (stage) {
      rows = rows.filter(function (r) {
        return (r.stage || r.status || "new") === stage;
      });
    }
    renderTable(rows);
  }

  function updateKpis() {
    document.getElementById("kpi-total").textContent = String(leads.length);
    document.getElementById("kpi-new").textContent = String(
      leads.filter(function (r) {
        return (r.stage || r.status || "new") === "new";
      }).length
    );
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    document.getElementById("kpi-week").textContent = String(
      leads.filter(function (r) {
        return r.created_at && new Date(r.created_at).getTime() >= weekAgo;
      }).length
    );
  }

  function openDetail(id) {
    selectedId = id;
    const r = leads.find(function (x) {
      return String(x.id) === String(id);
    });
    if (!r) return;
    const panel = document.getElementById("lead-detail");
    panel.style.display = "block";
    document.getElementById("lead-json").textContent = JSON.stringify(r, null, 2);
    document.getElementById("lead-stage").value = r.stage || r.status || "new";
    document.getElementById("lead-notes").value = r.staff_notes || "";
  }

  async function loadLeads(client) {
    const { data, error } = await client
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      gate.textContent =
        "Could not load leads: " +
        error.message +
        " — run supabase/profiles_admin_leads.sql and set your profile role.";
      leads = [];
    } else {
      leads = data || [];
    }
    updateKpis();
    applyFilters();
  }

  async function saveLead(client) {
    if (!selectedId) return;
    const stage = document.getElementById("lead-stage").value;
    const staff_notes = document.getElementById("lead-notes").value;
    const patch = { stage: stage, staff_notes: staff_notes };
    // status column if present in some schemas
    patch.status = stage;
    const { error } = await client.from("leads").update(patch).eq("id", selectedId);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    await loadLeads(client);
    openDetail(selectedId);
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const client = await requireStaff();
    if (!client) return;

    document.getElementById("btn-refresh").addEventListener("click", function () {
      loadLeads(client);
    });
    document.getElementById("filter-q").addEventListener("input", applyFilters);
    document.getElementById("filter-stage").addEventListener("change", applyFilters);
    document.getElementById("btn-save-lead").addEventListener("click", function () {
      saveLead(client);
    });
    document.getElementById("btn-signout").addEventListener("click", async function () {
      if (BFF.auth && BFF.auth.signOut) await BFF.auth.signOut();
      else await client.auth.signOut();
      location.href = "../pages/auth.html";
    });

    await loadLeads(client);
  });
})();
