# BFF Insurance Solutions™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **BFF Insurance Solutions™**, a solo-producer-ready, multi-agent-capable insurance platform covering lead generation, multi-line quoting (life, health, property, casualty), policy and client management, commissions, and a client portal.

You have two reference documents, provided separately:
1. **Technical Specification** — database schema, lead scoring logic, quoting engine requirements by line, commission calculation and reconciliation rules, compliance tracking, security architecture.
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–33.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** every lead, quote, application, and policy resolves to exactly one row in the correct table, tagged to exactly one client/household and one carrier/product. Every bound policy produces exactly one traceable commission record. No phase may introduce a shortcut that writes production numbers straight into a report or dashboard.

**Critical build-order note:** this platform starts with zero existing clients. Build Phase 2 (Lead Generation and Quoting) early — the platform's first job is generating a book of business, not managing one that doesn't exist yet. Do not build the Client Portal (Phase 5) until Phase 3 has real bound policies to show — a portal with nothing in it is wasted effort at this stage.

---

## PHASE 1 — Foundation and Compliance
**Build:** App foundation, branding/navigation, secure login with MFA, agent roles (solo today, multi-agent-ready), producer license and appointment tracking (state + line of authority + CE credits), carrier and product directory.

**Done when:** a producer can log in, see their tracked licenses and appointments, and the system knows which carriers/products/lines they're authorized to quote.

---

## PHASE 2 — Lead Generation and Quoting
**Build:** Lead capture (web form, referral, cold import, event), lead scoring per spec Section 4 (source quality, responsiveness, need signal, budget/timeline), pipeline stages (new → contacted → quoted → applied → bound, with lost/nurture branches), the multi-line quoting engine per spec Section 5.1 (different required inputs per line), quote comparison, needs analysis/coverage-gap calculator, lead-to-client conversion (triggered at first application submission, not at bind).

**Done when:** a lead can be captured, scored, quoted across at least two lines with line-appropriate inputs, and converted to a client record at the correct trigger point.

---

## PHASE 3 — Policy and Client Management (CRM)
**Build:** Client directory with household grouping, full policy register across all lines (policy_id traces back to source_quote_id), beneficiary/dependent tracking, renewal and anniversary alerts, cross-sell/coverage-gap detection across a household's existing policies, policy change/endorsement log.

**Done when:** a bound policy is visible in the client's record, correctly linked to its originating quote, with renewal dates tracked and alerting.

---

## PHASE 4 — Applications, Underwriting, Commissions
**Build:** Application submission with e-signature, underwriting status tracking (with a re-shop path back to quoting on decline/rating), commission schedule setup (per carrier/product/type), commission calculation per spec Section 6.1, statement reconciliation (import and match by policy_number + carrier_id, flag unmatched lines) per Section 6.2, chargeback handling per Section 6.3.

**Done when:** a bound policy automatically generates a pending commission record, and an imported carrier statement correctly matches and marks it paid — with unmatched lines flagged, not dropped.

---

## PHASE 5 — Client Portal
**Build:** Client self-service login (separate, narrower permission scope than agent-side — see spec Section 8 note), policy and document access, claims initiation and status tracking, secure messaging.

**Done when:** a client can log in and see only their own household's policies and claims — verify this explicitly, since it's the first external-facing login in the system.

---

## PHASE 6 — Compliance, Reporting, Security, Launch
**Build:** Compliance dashboard (license expiration alerts at 90/30/7 days, CE credit tracking, carrier appointment status, E&O insurance expiration), production reports (sales by line/carrier/month), persistency and retention reports, AI assistant, full security hardening per spec Section 8, testing pass, production launch.

**Done when:** compliance alerts fire correctly against real expiration dates, every report is a read-only rollup off Policies/Commissions, and security controls are verifiably in place.

---

## Build Order Rules

1. **Do not build quoting logic for a line before its required-inputs schema (spec Section 5.1) is implemented.** Each line's underwriting inputs are genuinely different — don't reuse a life insurance form for auto quotes.
2. **Do not let any phase write a bound policy or commission directly into a report or dashboard number.** Route everything through Policies and Commissions tables.
3. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.
4. **If a shortcut would be faster but would create a second write path around the Policies/Commissions tables, default to the roadmap's approach** — the trustworthiness of production and commission numbers depends on this.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation and Compliance | 1–6 | Not started | |
| 2 — Lead Generation and Quoting | 7–12 | Not started | |
| 3 — Policy and Client Management | 13–18 | Not started | |
| 4 — Applications, Underwriting, Commissions | 19–23 | Not started | |
| 5 — Client Portal | 24–27 | Not started | |
| 6 — Compliance, Reporting, Security, Launch | 28–33 | Not started | |
