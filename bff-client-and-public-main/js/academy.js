/**
 * Business Academy — enrollment gate + Kahoot-style quiz modules
 */
window.BFF = window.BFF || {};

BFF.academy = (function () {
  const PROGRESS_KEY = "bff_academy_progress";
  const UNLOCK = "bff_unlock_academy";

  const MODULES = [
    {
      id: "m1",
      title: "Brand Presence Essentials",
      blurb: "Present your business with polished, funder-ready confidence.",
      questions: [
        {
          q: "What is the primary goal of a professional brand presence for a small business seeking funding?",
          options: [
            "Trend-chasing social posts only",
            "Clear, consistent credibility that builds trust",
            "Hiding financial weaknesses",
            "Using as many fonts as possible",
          ],
          answer: 1,
          explain:
            "Funders and partners respond to clarity and consistency — trust is the asset.",
        },
        {
          q: "Which element best supports “Moving You Forward” in client communications?",
          options: [
            "Vague promises without next steps",
            "Warm tone + concrete outcomes + clear call to action",
            "Only legal disclaimers",
            "All-caps marketing",
          ],
          answer: 1,
          explain: "Elegant warmth paired with concrete next steps is our signature.",
        },
        {
          q: "A gold hairline frame on a welcome page is an example of…",
          options: [
            "Clutter",
            "Refined brand detail that elevates first impression",
            "A technical requirement of HTML",
            "A substitute for a logo",
          ],
          answer: 1,
          explain: "Subtle decorative craft signals premium care without shouting.",
        },
      ],
    },
    {
      id: "m2",
      title: "Financial Confidence Basics",
      blurb: "Cash flow, readiness, and the language funders expect.",
      questions: [
        {
          q: "Why does cash-flow awareness matter before grant or loan applications?",
          options: [
            "It doesn’t",
            "It proves you can steward resources and meet obligations",
            "Only nonprofits need it",
            "It replaces a business plan",
          ],
          answer: 1,
          explain: "Stewardship signals are core to funding readiness.",
        },
        {
          q: "A Funding Readiness Assessment typically helps you…",
          options: [
            "Skip bookkeeping forever",
            "Identify gaps before funders do",
            "Guarantee an award",
            "Avoid all documentation",
          ],
          answer: 1,
          explain: "Knowing gaps early is strategic — not a weakness.",
        },
        {
          q: "Which is a healthy bookkeeping habit?",
          options: [
            "Mixing personal and business accounts",
            "Monthly reconciliations and clear categorization",
            "Saving receipts “someday”",
            "Only tracking cash in a notebook annually",
          ],
          answer: 1,
          explain: "Regular reconciliation builds confidence and clean reporting.",
        },
      ],
    },
    {
      id: "m3",
      title: "Due Diligence & Next Steps",
      blurb: "How Gigi, intake, and portals fit a real client journey.",
      questions: [
        {
          q: "Gigi’s role on the site is best described as…",
          options: [
            "A payment processor",
            "An AI concierge that answers questions and guides the journey",
            "A replacement for legal counsel",
            "Only a footer credit",
          ],
          answer: 1,
          explain: "Gigi is the Due Diligence Concierge — helpful, never a black box for secrets.",
        },
        {
          q: "In demo mode, a successful “purchase” should…",
          options: [
            "Delete your browser",
            "Unlock access locally so you can experience the product flow",
            "Email the entire internet",
            "Change the brand colors",
          ],
          answer: 1,
          explain: "localStorage unlocks mirror what webhooks will grant later.",
        },
        {
          q: "After Academy enrollment in the full vision, Stripe webhooks will help…",
          options: [
            "Style the CSS",
            "Notify admin and unlock access server-side without trusting the browser alone",
            "Replace the welcome video",
            "Design logos",
          ],
          answer: 1,
          explain: "Webhooks are the trustworthy server event for paid enrollment.",
        },
      ],
    },
  ];

  function isEnrolled() {
    return BFF.storage.isUnlocked(UNLOCK);
  }

  function getProgress() {
    return BFF.storage.get(PROGRESS_KEY, { completed: {}, scores: {} });
  }

  function saveProgress(p) {
    BFF.storage.set(PROGRESS_KEY, p);
  }

  function showViews() {
    const gate = document.getElementById("academy-gate");
    const app = document.getElementById("academy-app");
    if (!gate || !app) return;
    if (isEnrolled()) {
      gate.hidden = true;
      app.hidden = false;
      renderModules();
    } else {
      gate.hidden = false;
      app.hidden = true;
    }
  }

  function renderModules() {
    const root = document.getElementById("curriculum-grid");
    if (!root) return;
    const progress = getProgress();

    root.innerHTML = MODULES.map((m, i) => {
      const done = Boolean(progress.completed[m.id]);
      const score = progress.scores[m.id];
      const prevDone = i === 0 || progress.completed[MODULES[i - 1].id];
      const locked = !prevDone && !done;
      return `
        <article class="module-card ${done ? "is-complete" : locked ? "is-locked" : "is-available"}">
          <div class="module-card__num">Module ${String(i + 1).padStart(2, "0")}</div>
          <h3>${BFF.ui.escapeHtml(m.title)}</h3>
          <p>${BFF.ui.escapeHtml(m.blurb)}</p>
          <div class="module-card__status">
            ${
              done
                ? `Complete · ${score.correct}/${score.total}`
                : locked
                  ? "Complete previous module"
                  : "Ready to play"
            }
          </div>
          <button type="button" class="btn ${done ? "btn--outline" : "btn--rose"} btn--sm" style="margin-top:1rem"
            data-module="${m.id}" ${locked ? "disabled" : ""}>
            ${done ? "Replay quiz" : "Start quiz"}
          </button>
        </article>
      `;
    }).join("");

    root.querySelectorAll("[data-module]").forEach((btn) => {
      btn.addEventListener("click", () => startQuiz(btn.getAttribute("data-module")));
    });

    renderUnlocks(progress);
  }

  function renderUnlocks(progress) {
    const el = document.getElementById("academy-unlocks");
    if (!el) return;
    const allDone = MODULES.every((m) => progress.completed[m.id]);
    if (!allDone) {
      el.innerHTML = `
        <div class="demo-banner">
          <strong>Graduate unlocks</strong><br/>
          Complete all three modules to highlight your standalone graduate products.
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="academy-results">
        <p class="eyebrow">Curriculum complete</p>
        <h2>You finished the Academy path</h2>
        <p class="script">Well done.</p>
        <p style="color:var(--charcoal-soft);margin-bottom:0.5rem">
          Standalone products unlocked with your enrollment are ready below.
        </p>
        <div class="unlock-grid">
          <div class="unlock-item">
            <h4>Graduate Playbook</h4>
            <p>Ops map, 90-day calendar, template vault — demo access on.</p>
            <span class="badge badge--unlock" style="margin-top:0.5rem">Unlocked</span>
          </div>
          <div class="unlock-item">
            <h4>Certificate (demo)</h4>
            <p>A printable certificate can attach here when backend is live.</p>
            <span class="badge badge--rose" style="margin-top:0.5rem">Coming soon</span>
          </div>
        </div>
      </div>`;
  }

  let quizState = null;

  function startQuiz(moduleId) {
    const mod = MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    quizState = {
      moduleId,
      index: 0,
      correct: 0,
      total: mod.questions.length,
      answered: false,
    };
    document.getElementById("curriculum-section").hidden = true;
    document.getElementById("quiz-section").hidden = false;
    paintQuestion();
  }

  function paintQuestion() {
    const mod = MODULES.find((m) => m.id === quizState.moduleId);
    const q = mod.questions[quizState.index];
    const shell = document.getElementById("quiz-shell");
    const pct = (quizState.index / quizState.total) * 100;

    shell.innerHTML = `
      <div class="quiz-progress"><div class="quiz-progress__bar" style="width:${pct}%"></div></div>
      <div class="quiz-card">
        <div class="quiz-card__meta">
          <span>${BFF.ui.escapeHtml(mod.title)}</span>
          <span>Question ${quizState.index + 1} of ${quizState.total}</span>
        </div>
        <h2 class="quiz-card__q">${BFF.ui.escapeHtml(q.q)}</h2>
        <div class="quiz-options" id="quiz-options">
          ${q.options
            .map(
              (opt, i) =>
                `<button type="button" class="quiz-option" data-i="${i}">${BFF.ui.escapeHtml(opt)}</button>`
            )
            .join("")}
        </div>
        <div class="quiz-feedback" id="quiz-feedback"></div>
        <div class="quiz-footer">
          <span class="quiz-score">Score ${quizState.correct} correct</span>
          <button type="button" class="btn btn--primary btn--sm" id="quiz-next" hidden>Continue</button>
        </div>
      </div>
    `;

    quizState.answered = false;
    shell.querySelectorAll(".quiz-option").forEach((btn) => {
      btn.addEventListener("click", () => selectAnswer(Number(btn.dataset.i)));
    });
    shell.querySelector("#quiz-next")?.addEventListener("click", nextQuestion);
  }

  function selectAnswer(i) {
    if (quizState.answered) return;
    quizState.answered = true;
    const mod = MODULES.find((m) => m.id === quizState.moduleId);
    const q = mod.questions[quizState.index];
    const options = document.querySelectorAll(".quiz-option");
    options.forEach((btn) => {
      btn.disabled = true;
      const idx = Number(btn.dataset.i);
      if (idx === q.answer) btn.classList.add("is-correct");
      if (idx === i && i !== q.answer) btn.classList.add("is-wrong");
      if (idx === i) btn.classList.add("is-selected");
    });

    const fb = document.getElementById("quiz-feedback");
    const ok = i === q.answer;
    if (ok) quizState.correct += 1;
    fb.className = "quiz-feedback is-show " + (ok ? "quiz-feedback--ok" : "quiz-feedback--no");
    fb.textContent = (ok ? "Correct. " : "Not quite. ") + q.explain;

    document.querySelector(".quiz-score").textContent =
      "Score " + quizState.correct + " correct";
    document.getElementById("quiz-next").hidden = false;

    const pct = ((quizState.index + 1) / quizState.total) * 100;
    document.querySelector(".quiz-progress__bar").style.width = pct + "%";
  }

  function nextQuestion() {
    if (quizState.index + 1 >= quizState.total) {
      finishModule();
      return;
    }
    quizState.index += 1;
    paintQuestion();
  }

  function finishModule() {
    const progress = getProgress();
    progress.completed[quizState.moduleId] = true;
    progress.scores[quizState.moduleId] = {
      correct: quizState.correct,
      total: quizState.total,
    };
    saveProgress(progress);

    document.getElementById("quiz-section").hidden = true;
    document.getElementById("curriculum-section").hidden = false;
    BFF.ui.toast("Module complete — beautiful work");
    renderModules();
  }

  function exitQuiz() {
    document.getElementById("quiz-section").hidden = true;
    document.getElementById("curriculum-section").hidden = false;
  }

  function init() {
    const enrollBtn = document.getElementById("enroll-academy");
    if (enrollBtn) {
      enrollBtn.addEventListener("click", (e) => {
        e.preventDefault();
        BFF.ui.startCheckout("academy_enroll");
      });
    }

    const demoEnroll = document.getElementById("demo-enroll");
    if (demoEnroll) {
      demoEnroll.addEventListener("click", (e) => {
        e.preventDefault();
        BFF.storage.completePurchase("academy_enroll", { mode: "demo" });
        BFF.ui.toast("Academy unlocked (demo)");
        showViews();
      });
    }

    document.getElementById("quiz-exit")?.addEventListener("click", exitQuiz);

    // If redirected from success.html with academy product
    showViews();
    window.addEventListener("bff:unlock", showViews);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { showViews, isEnrolled, MODULES };
})();
