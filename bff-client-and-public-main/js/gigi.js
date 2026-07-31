/**
 * Gigi — Due Diligence Concierge
 * Local FAQ when GIGI_ENDPOINT is null; live API when configured.
 */
window.BFF = window.BFF || {};

BFF.gigi = (function () {
  const GREETING =
    "Hello, I'm Gigi — your Due Diligence Concierge at Best Face Forward. I can guide you through our divisions, packages, Academy, Expense IQ, or what to prepare for intake. How may I help?";

  const FAQ = [
    {
      keys: ["academy", "enroll", "course", "learn", "quiz", "curriculum"],
      reply:
        "Business Academy is our learning portal under G&G Software. Enrollment and curriculum open as offerings go live — use Contact to request Academy access, or browse the Academy page for updates.",
    },
    {
      keys: ["software", "product", "buy", "purchase", "download", "g&g", "gg", "stripe"],
      reply:
        "G&G Software Solutions and division packages use secure Stripe Payment Links. Open the Software, Financial, Foundation, or Logistics portal and choose Buy with Stripe. After payment, our webhook records your entitlement in Supabase.",
    },
    {
      keys: ["expense", "eiq", "ledger"],
      reply:
        "Expense IQ is our multi-tenant financial platform. Sign in with a confirmed email at the site Sign-in page. Access requires an active Expense IQ subscription (or a staff profile). Subscription checkout is listed as Coming soon until the Payment Link is published.",
    },
    {
      keys: ["grant", "foundation", "nonprofit", "funding"],
      reply:
        "Best Face Forward Foundation supports grant readiness, nonprofit startup, strategic planning, and grant writing. Live Stripe packages are on the Foundation portal; custom grant writing is quote-based via Contact.",
    },
    {
      keys: ["bookkeep", "financial", "tax", "accounting", "cash", "cfo"],
      reply:
        "Financial Solutions covers bookkeeping, Phase I/II growth packages, CFO advisory, and financial cleanup — all available with Stripe checkout on the Financial portal.",
    },
    {
      keys: ["insurance", "life", "health", "retirement", "benefits"],
      reply:
        "Insurance Solutions helps protect today while building tomorrow — life, health, final expense, retirement, and benefits. Explore the Insurance portal and Contact us for a consult.",
    },
    {
      keys: ["logistics", "supply", "route", "ops", "operations", "transport"],
      reply:
        "Logistics Consulting covers assessments, startup packages, route optimization, operations manuals, and success bundles — live Stripe checkout on the Logistics portal.",
    },
    {
      keys: ["pay", "payment", "checkout", "price", "cost", "subscribe"],
      reply:
        "Checkout is live Stripe Payment Links (not a demo). After you pay, Stripe webhooks write your entitlement to Supabase subscriptions. Sign in with the same email you used at checkout for product access.",
    },
    {
      keys: ["contact", "email", "phone", "reach", "talk", "human"],
      reply:
        "Use the Contact page to send an intake message — it is saved to our Supabase leads pipeline. Mention your division so the right team can follow up.",
    },
    {
      keys: ["about", "who", "culture", "owner", "story"],
      reply:
        "Best Face Forward Consultants delivers strategy, solutions, and impact across Foundation, Financial, Insurance, Logistics, and G&G Software. Visit About and Culture for the full story.",
    },
    {
      keys: ["hello", "hi", "hey", "help"],
      reply:
        "Welcome. Ask about grants, bookkeeping, insurance, logistics, Expense IQ, or G&G Software — or use Contact for a human follow-up.",
    },
  ];

  let opened = false;

  function ensureDom() {
    if (document.getElementById("gigi-launcher")) return;

    const launcher = document.createElement("button");
    launcher.id = "gigi-launcher";
    launcher.className = "gigi-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Gigi assistant");
    launcher.innerHTML = "G";
    launcher.addEventListener("click", toggle);

    const panel = document.createElement("div");
    panel.id = "gigi-panel";
    panel.className = "gigi-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Gigi chat");
    panel.innerHTML = `
      <div class="gigi-panel__head">
        <div class="gigi-avatar">G</div>
        <div class="gigi-panel__meta">
          <strong>Gigi</strong>
          <span>Due Diligence Concierge</span>
        </div>
        <button type="button" class="gigi-close" aria-label="Close">&times;</button>
      </div>
      <div class="gigi-messages" id="gigi-messages"></div>
      <div class="gigi-demo-note" id="gigi-status-note"></div>
      <div class="gigi-input-row">
        <input id="gigi-input" type="text" placeholder="Ask Gigi a question..." autocomplete="off" />
        <button type="button" class="gigi-send" id="gigi-send" aria-label="Send">➤</button>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    panel.querySelector(".gigi-close").addEventListener("click", toggle);
    panel.querySelector("#gigi-send").addEventListener("click", send);
    panel.querySelector("#gigi-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    updateStatusNote();
  }

  function updateStatusNote() {
    const note = document.getElementById("gigi-status-note");
    if (!note) return;
    const live = Boolean(BFF.config?.GIGI_ENDPOINT);
    if (live) {
      note.style.display = "none";
    } else {
      note.style.display = "block";
      note.textContent = "On-site guide · full AI endpoint coming soon";
    }
  }

  function toggle() {
    ensureDom();
    const panel = document.getElementById("gigi-panel");
    panel.classList.toggle("is-open");
    if (panel.classList.contains("is-open") && !opened) {
      opened = true;
      append("bot", GREETING);
    }
    if (panel.classList.contains("is-open")) {
      document.getElementById("gigi-input")?.focus();
    }
  }

  function append(role, text) {
    const wrap = document.getElementById("gigi-messages");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className =
      "gigi-bubble " + (role === "user" ? "gigi-bubble--user" : "gigi-bubble--bot");
    el.textContent = text;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function send() {
    const input = document.getElementById("gigi-input");
    const text = (input?.value || "").trim();
    if (!text) return;
    append("user", text);
    input.value = "";
    append("bot", await getGigiReply(text));
  }

  function localReply(userText) {
    const t = userText.toLowerCase();
    for (const item of FAQ) {
      if (item.keys.some((k) => t.includes(k))) return item.reply;
    }
    return "I can help with Foundation, Financial, Insurance, Logistics, G&G Software, Expense IQ, or Contact. Ask about a specific service for details.";
  }

  async function getGigiReply(userText) {
    const endpoint = BFF.config?.GIGI_ENDPOINT;
    if (!endpoint) {
      await new Promise((r) => setTimeout(r, 280));
      return localReply(userText);
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      return data.reply || "Could you rephrase that for me?";
    } catch (err) {
      console.error(err);
      return "I'm having trouble connecting. Please try again shortly, or use the Contact page.";
    }
  }

  function init() {
    if (document.body.dataset.gigi === "off") return;
    ensureDom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { toggle, getGigiReply, init };
})();
