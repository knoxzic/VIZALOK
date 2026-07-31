# BFF Family Foundation™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **BFF Family Foundation™** — a private 501(c)(3) foundation's own grant-*making* platform. This is the inverse of every other BFF platform: instead of helping a client receive or track money, this one gives money away, under federal tax law that penalizes giving away too little.

You have two reference documents, provided separately:
1. **Technical Specification** — the grant lifecycle, database schema, the IRC §4942 5% minimum distribution calculation, expenditure responsibility and self-dealing compliance gates, and reporting/transparency requirements.
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–30.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** every disbursement must count toward the running IRC §4942 5% minimum distribution total in real time, not batched or estimated at year-end. A shortfall triggers a real 30% federal excise tax — this is the single highest-stakes calculation in this entire platform.

**Critical build-order note:** build Section 4's distribution tracking logic (Phase 4, Prompts 19–20) with real test coverage before considering this platform launch-ready. Get this wrong and it's not a bug, it's a tax liability.

---

## PHASE 1 — Foundation and Governance
**Build:** App foundation, branding/navigation, secure login with MFA, board and review committee roles (with a disqualified_person_flag on family board members for self-dealing checks), endowment/investment asset tracking, grant focus area and guidelines configuration.

**Done when:** the system can calculate average net investment assets for a reporting period, and board members are correctly flagged as disqualified persons where applicable.

---

## PHASE 2 — Grant Application Intake
**Build:** Public grant guidelines portal, application intake form, applicant 501(c)(3)/EIN verification, completeness check, assignment to review committee, applicant communication/status tracking.

**Done when:** an application without a verified EIN/501(c)(3) status cannot progress past intake, and incomplete applications route back to the applicant with specific missing items, not a generic rejection.

---

## PHASE 3 — Review and Award Decision
**Build:** Community review committee scoring rubric (per-category, not one aggregate score — spec Section 5.1), review deliberation and recommendation, Foundation Board approval workflow, award letter/grant agreement generation, decline notification, conflict of interest check.

**Done when:** a board member flagged as a disqualified person relative to a specific applicant is automatically recused, and a board vote cannot be recorded without a quorum of non-recused members.

---

## PHASE 4 — Distribution and Compliance
**Build:** the IRC §4942 5% minimum distribution calculation and real-time tracking (spec Section 4.1 — this is the priority build in this phase), grant payment/disbursement processing, expenditure responsibility tracking for non-public-charity grantees (spec Section 5.2), grantee reporting requirements, grant compliance monitoring.

**Done when:** every disbursement updates the running distribution total at the moment it posts, the platform surfaces the gap between required and actual distribution continuously (not just at year-end), and a grant to a non-public-charity automatically triggers the expenditure responsibility workflow without a reviewer having to remember to flag it.

---

## PHASE 5 — Reporting and Transparency
**Build:** Form 990-PF data preparation (structured export, not automated filing — final prep stays with BFF Grant & Nonprofit Solutions), public disclosure requirements, annual report generation for the family/board, grant impact and outcomes tracking.

**Done when:** the 990-PF data export correctly reflects grants paid, administrative expenses, and the 5% calculation, and every live grant cycle has a required published_url for its guidelines.

---

## PHASE 6 — AI, Security, Launch
**Build:** Gigi integration (embed via GG AI Concierge™ — do not build a local assistant), full security hardening per spec Section 7, testing pass, production launch.

**Done when:** review committee members cannot see other reviewers' scores until their own is submitted (anti-anchoring-bias requirement), and the audit log captures every application status change, recusal, board vote, and disbursement append-only.

---

## Build Order Rules

1. **Do not treat the 5% distribution calculation as a reporting feature to add later.** It's core logic that should exist from Phase 4 onward and be tested against real excise tax consequences, not just unit-tested for arithmetic correctness.
2. **Do not let a disqualified-person board member's recusal be optional or self-reported.** It must be system-enforced (spec Section 5.3).
3. **Do not build expenditure responsibility as a manual checklist a reviewer might forget.** The requires_expenditure_responsibility flag must trigger the full workflow automatically.
4. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation and Governance | 1–6 | Not started | |
| 2 — Grant Application Intake | 7–12 | Not started | |
| 3 — Review and Award Decision | 13–18 | Not started | |
| 4 — Distribution and Compliance | 19–23 | Not started | Highest-priority testing before launch |
| 5 — Reporting and Transparency | 24–27 | Not started | |
| 6 — AI, Security, Launch | 28–30 | Not started | |
