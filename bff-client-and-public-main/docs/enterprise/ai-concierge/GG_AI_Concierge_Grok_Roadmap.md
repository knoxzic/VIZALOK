# GG AI Concierge™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **GG AI Concierge™** — the shared AI service behind Gigi, built once and embedded across all five other BFF platforms (Expense IQ™, Insurance Solutions™, Financial Solutions™, Logistics™, G&G Software Solutions™) as their AI Assistant.

You have two reference documents, provided separately:
1. **Technical Specification** — Gigi's persona/voice definition, embedding architecture, database schema, Financial Language Academy structure, and the escalation/licensed-advice-boundary logic.
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–30.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** Gigi is built once, here, and embedded everywhere else via API. No host platform gets its own local copy of her persona, knowledge logic, or escalation rules. Every conversation resolves to either an answer within her knowledge domain or an escalation to a human — never a confident guess on a question that legally requires a licensed professional.

**Critical build-order note:** build Phases 1–2 (Foundation and Conversational Engine) completely before starting Phase 3 (Host Platform Integration). Gigi needs to work generically first — if you start wiring her into Expense IQ before her core persona and escalation logic exist, you'll end up building platform-specific logic that should have been generic.

---

## PHASE 1 — Foundation and Persona Engine
**Build:** API-first service foundation (embeddable from day one, not a standalone app with an API bolted on later), branding/voice/visual persona assets, secure access (per-host-platform API keys, MFA for admin), Gigi's persona and voice configuration, knowledge base architecture (organized by domain — one per host platform, plus academy), embedding SDK/API.

**Done when:** Gigi's voice/persona is defined as data (not hardcoded per response), and a test host platform can authenticate and pull a knowledge domain via API.

---

## PHASE 2 — Conversational and Due Diligence Engine
**Build:** Plain-language Q&A engine, report/terminology explanation module, checklist/reminder/alert generation, corrective action suggestions, due-diligence workflow support (context-aware per host platform), escalation to human per spec Section 6.

**Done when:** Gigi correctly escalates a licensed-advice-boundary question (e.g., "should I take this specific tax position") instead of answering it directly — verify this against the trigger table in spec Section 6.1, not just spot-checked informally.

---

## PHASE 3 — Host Platform Integration
**Build:** Integration for each of the five platforms (Expense IQ, Insurance Solutions, Financial Solutions, Logistics, G&G Software Solutions), plus cross-platform context handoff so a client using multiple BFF platforms gets one consistent Gigi identity.

**Done when:** the same client's conversations across two different host platforms link under one client_identity_id, without one platform's sensitive context leaking into another's conversation unnecessarily (spec Section 3.2).

---

## PHASE 4 — Financial Language Academy
**Build:** Curriculum structure across the six language subject areas, Gigi-guided lessons and scenario-based learning, interactive assessments and certification tracking, membership/pricing management ($49/mo or $497/yr), progress tracking and gamification (financial education board game, storyboards).

**Important:** the Academy's name is an open decision (spec Section 5, calloutBox) — confirm "Financial Language Academy™" vs. "GG Financial Language Academy™" with Jameal before this phase locks in UI copy, marketing material, or the domain_name enum value.

**Done when:** a member can complete a course, take an assessment, and earn one of the three defined certifications (Financial Language Certified™, Grant Ready Certification, Business Finance Certification).

---

## PHASE 5 — Analytics, Escalation, Admin
**Build:** Conversation analytics (resolution rate, escalation rate), admin console for knowledge base management and escalation review, compliance/audit log.

**Done when:** every escalation from Phase 2 is visible and actionable in the admin console, and the audit log captures every conversation, escalation, and knowledge base change append-only.

---

## PHASE 6 — Security, Reporting, Launch
**Build:** Practice-wide Gigi usage reporting across all host platforms, full security hardening per spec Section 7, testing (persona consistency, accuracy, escalation triggers), production launch.

**Done when:** usage reporting can show which host platform is generating the most conversations/escalations, and persona consistency has been tested — Gigi should sound like the same assistant whether she's embedded in Expense IQ or Logistics.

---

## Build Order Rules

1. **Do not build platform-specific Gigi logic before her generic core exists.** Phases 1–2 first, always.
2. **Do not let a host platform bypass the escalation gate.** If a host platform's integration somehow lets a question skip the confidence/licensed-advice check, that's a critical bug, not a minor one.
3. **Do not hardcode the Financial Language Academy name anywhere** until the naming decision (Phase 4 note) is resolved — use a config value, not a literal string, so the rename is a one-line change rather than a find-and-replace across the codebase.
4. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation and Persona Engine | 1–6 | Not started | |
| 2 — Conversational and Due Diligence Engine | 7–12 | Not started | |
| 3 — Host Platform Integration | 13–18 | Not started | |
| 4 — Financial Language Academy | 19–23 | Not started | Naming decision pending |
| 5 — Analytics, Escalation, Admin | 24–26 | Not started | |
| 6 — Security, Reporting, Launch | 27–30 | Not started | |
