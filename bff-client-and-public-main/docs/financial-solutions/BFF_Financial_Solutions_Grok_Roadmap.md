# BFF Financial Solutions™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **BFF Financial Solutions™**, a solo-practitioner-ready, scalable financial consulting practice platform covering four client service lines (bookkeeping/accounting, individual financial advisory, tax preparation, business financial analysis/reporting) plus a fifth, structurally separate revenue line: tax software service bureau sales to independent sub-preparers.

You have two reference documents, provided separately:
1. **Technical Specification** — the client/engagement data model, database schema, service-line-specific intake and delivery logic, fee proposal engine, tax due diligence gate, security architecture.
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–33.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** a single client can have up to four concurrent engagements (one per service line), each with its own scope and fee structure — but every invoice must trace to exactly one engagement, every bookkeeping transaction must resolve to exactly one Chart of Accounts code within that client's own ledger, and every tax return must pass its due diligence checklist before it can be marked filed.

**Critical build-order note:** this platform starts with zero existing clients — build Phase 2 (Lead Generation and Engagement Intake) early. Also note: Phase 3 (Bookkeeping) intentionally reuses the Ledger → Chart of Accounts pattern from the separate Expense IQ™ specification. If Expense IQ has already been built, reference that implementation for Phase 3 rather than rebuilding the pattern from scratch.

---

## PHASE 1 — Foundation and Compliance
**Build:** App foundation, branding/navigation, secure login with MFA, consultant roles (solo today, scalable), professional credentials tracking (GMCP, PTIN, Xero certification, CE requirements), client type and engagement directory (individual vs. business).

**Done when:** a consultant can log in, see their tracked credentials/CE status, and the system distinguishes individual clients from business clients for downstream intake logic.

---

## PHASE 2 — Lead Generation and Engagement Intake
**Build:** Lead capture with multi-select service-line interest, lead scoring and pipeline, discovery/intake questionnaires that vary by service line (spec Section 4), engagement letter and scope-of-work generator, fee proposal engine per spec Section 5.1 (hourly/flat/retainer), lead-to-client conversion triggered at engagement letter signature.

**Done when:** a lead can select interest in multiple service lines, complete the correct intake questionnaire for each, receive a fee proposal, and convert to a Client + Engagement record only once the engagement letter is signed — not before.

---

## PHASE 3 — Bookkeeping and Accounting Module
**Build:** Per-client Chart of Accounts setup (SMB or nonprofit template), transaction import and categorization (bank/Xero sync), bookkeeping cleanup project tracker (separate from ongoing monthly bookkeeping status), monthly close checklist and reconciliation, financial statement generation, client financial health dashboard.

**Done when:** a client's transactions post to their own Chart of Accounts exactly like Expense IQ's Ledger — same posting discipline, scoped per client instead of per org.

---

## PHASE 4 — Advisory, Tax, and Analysis
**Build:** Individual financial planning module (net worth snapshots, goal tracking, recommendations log with accepted/declined status), tax prep workflow with the Form 8867 due diligence checklist as a hard gate (spec Section 5.2), entity-type-aware tax deadline and compliance calendar, business financial analysis/KPI reporting (drawing from Phase 3 data for bookkeeping clients, supporting manual upload for analysis-only clients), advisory session notes log.

**Done when:** a tax return cannot be marked "filed" while its due diligence checklist is incomplete — verify this is a hard block, not a warning.

---

## PHASE 5 — Client Portal and Billing
**Build:** Client self-service portal (documents, statements, secure messaging), document upload and e-signature, invoicing per engagement fee structure (spec Section 5.1), payment processing and AR tracking.

**Done when:** every invoice references a specific engagement_id (never a bare client_id), and a client with multiple engagements sees each billed and tracked separately.

---

## PHASE 6 — Compliance, Reporting, Security, Launch
**Build:** Practice compliance dashboard (PTIN renewal, GMCP CE credits, Xero certification status), practice-wide reporting (revenue by service line, consultant utilization, client profitability), referral and retention reports, AI assistant, full security hardening per spec Section 6, testing pass, production launch.

**Done when:** revenue reporting correctly splits by service line even for clients with multiple concurrent engagements, and every report is a read-only rollup off Engagements/Invoices/Transactions.

---

## PHASE 7 — Tax Software and Service Bureau Sales
**Build:** Service bureau account setup (software vendor agreement, wholesale cost per seat), sub-preparer onboarding with EFIN/PTIN verification, software license/seat management per sub-preparer per tax year, revenue share and margin calculation (spec Section 8.2), sub-preparer production and compliance monitoring (lightweight usage tracking, not a work-product audit), service bureau billing and annual renewal cycle (spec Section 8.4).

**Important:** sub-preparers are wholesale software customers, not BFF clients. Do not route them through the Clients/Engagements tables built in Phases 1–6 — they get their own Sub-Preparers, Software Licenses, and Service Bureau Revenue tables (spec Section 8.1). This phase does not depend on Phases 2–6 and can be built in parallel with them once Phase 1 (Foundation) is complete.

**Done when:** a software license cannot activate for a sub-preparer with an expired or invalid EFIN/PTIN (spec Section 8.3 — verify this is a hard gate), and service bureau revenue reports separately from client service-line revenue in Phase 6's practice-wide reporting, never blended into one number.

---

## Build Order Rules

1. **Do not let a client record collapse multiple service-line engagements into one.** A client with bookkeeping + tax needs two engagement records, two fee structures, potentially two different statuses.
2. **Do not allow the tax due diligence gate to be bypassed, skipped, or overridden without a logged reason.** This is a compliance requirement, not a UX suggestion.
3. **Do not duplicate the Ledger/Chart of Accounts logic from scratch if Expense IQ's implementation is available to reference.** Reuse the pattern for consistency across the BFF suite.
4. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation and Compliance | 1–6 | Not started | |
| 2 — Lead Generation and Engagement Intake | 7–12 | Not started | |
| 3 — Bookkeeping and Accounting Module | 13–18 | Not started | |
| 4 — Advisory, Tax, and Analysis | 19–23 | Not started | |
| 5 — Client Portal and Billing | 24–27 | Not started | |
| 6 — Compliance, Reporting, Security, Launch | 28–33 | Not started | |
| 7 — Tax Software and Service Bureau Sales | 34–39 | Not started | Can run in parallel with Phases 2–6 |
