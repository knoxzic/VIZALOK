/**
 * Gigi — AI Due Diligence Concierge
 * Demo knowledge base now; swap getGigiReply to hit GIGI_ENDPOINT later.
 */
window.BFF = window.BFF || {};

BFF.gigi = (function () {
  const GREETING =
    "Hello, I'm Gigi — your Due Diligence Concierge at Best Face Forward. I can guide you through our five divisions, Academy enrollment, software products, or what to prepare for intake. What may I help you with?";

  const FAQ = [
    {
      keys: ["academy", "enroll", "course", "learn", "quiz", "curriculum"],
      reply:
        "Our Business Academy is a game-based learning experience with elegant, feminine business styling. Enroll once (demo unlock works offline), complete modules and quizzes, then unlock standalone graduate products. Open the Academy portal from the landing page under G&G Software Solutions → Academy.",
    },
    {
      keys: ["software", "product", "buy", "purchase", "download", "g&g", "gg"],
      reply:
        "G&G Software Solutions offers digital products and service packages — Starter Kit, Funding Readiness, Accelerators, and more. In demo mode, checkout simulates Stripe and unlocks access in your browser. Use the Software portal for a guided buy flow.",
    },
    {
      keys: ["grant", "foundation", "nonprofit", "funding"],
      reply:
        "Best Face Forward Foundation supports grant writing, grant readiness, board development, and capacity building. Visit the Foundation portal for services; for ready-to-buy packages, see Software or ask about Funding Readiness Assessment.",
    },
    {
      keys: ["bookkeep", "financial", "tax", "accounting", "cash"],
      reply:
        "Financial Solutions covers bookkeeping, controller services, cash flow, budgeting, and strategic financial planning. The portal is structured and ready — full client workflows arrive with the backend phase.",
    },
    {
      keys: ["insurance", "life", "health", "retirement", "benefits"],
      reply:
        "Insurance Solutions helps protect today while building tomorrow — life, health, final expense, annuities, retirement planning, and benefits. Contact us from the Insurance portal or Contact page for a consult.",
    },
    {
      keys: ["logistics", "supply", "route", "ops", "operations"],
      reply:
        "Logistics Consulting focuses on strategy, route optimization, supply chain, vendor management, and operational efficiency. Explore the Logistics portal for an overview and request a conversation.",
    },
    {
      keys: ["stripe", "pay", "payment", "checkout", "price", "cost"],
      reply:
        "We're in demo stage: purchases can simulate success and unlock content via localStorage. Real Stripe Payment Links are already wired for several software products. Webhooks will later notify admin (e.g. Academy enrollment emails) without changing these pages.",
    },
    {
      keys: ["contact", "email", "phone", "reach", "talk", "human"],
      reply:
        "Use the Contact page for a polished intake message, or start an intake from the public site when forms are live. For urgent needs, mention your division of interest so the right team can follow up.",
    },
    {
      keys: ["about", "who", "culture", "owner", "story"],
      reply:
        "Best Face Forward Consultants delivers strategy, solutions, and impact across five divisions. Our brand promise: innovative solutions with integrity, growth with purpose, and lasting impact. Visit About and Culture for the full story.",
    },
    {
      keys: ["hello", "hi", "hey", "help"],
      reply:
        "Welcome. I can explain divisions, walk you through Academy enrollment, or help you pick a software product. Try asking about grants, bookkeeping, insurance, logistics, or G&G Software.",
    },
  ];

  let opened = false;
  let root = null;

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
      <div class="gigi-demo-note" id="gigi-demo-note">Demo mode — smart local answers until the AI backend is connected.</div>
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

    root = panel;
    updateDemoNote();
  }

  function updateDemoNote() {
    const note = document.getElementById("gigi-demo-note");
    if (!note) return;
    const live = Boolean(BFF.config?.GIGI_ENDPOINT);
    note.textContent = live
      ? "Connected to live Gigi endpoint."
      : "Demo mode — smart local answers until the AI backend is connected.";
    note.style.display = live ? "none" : "block";
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
    return "I can help with our five divisions (Foundation, Financial, Insurance, Logistics, G&G Software), Academy enrollment, product purchases, or how demo unlocks work. Ask about a specific service, or visit Contact for a human follow-up.";
  }

  async function getGigiReply(userText) {
    const endpoint = BFF.config?.GIGI_ENDPOINT;
    if (!endpoint) {
      await new Promise((r) => setTimeout(r, 350));
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
    // Skip on pure welcome gate if desired — still useful, so we show everywhere
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
