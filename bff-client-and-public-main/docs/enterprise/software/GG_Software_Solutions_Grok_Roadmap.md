# G&G Software Solutions™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **G&G Software Solutions™**, a dual-purpose platform running custom software development services (client-commissioned builds) alongside productized software (licensed/subscribed products), with Information Systems Monitoring scoped as a confirmed future phase.

You have two reference documents, provided separately:
1. **Technical Specification** — the two-business-model architecture, database schema, custom dev project logic, subscription/productized software logic, and the Information Systems Monitoring spec (scoped, not for initial build).
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–33, with Phase 5 (Monitoring) marked as a future phase.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** a custom dev project and a product subscription are never the same record type, even for the same client account. Every invoice traces to exactly one source (a project milestone, project hours, or a subscription) — never ambiguous, never blended. Revenue reports by line (dev services / product / future monitoring), never as one combined number.

**Critical build-order note:** Phase 5 (Information Systems Monitoring) is scoped in the Technical Specification but is explicitly **not** part of the initial build. Skip Prompts 23–28 unless told otherwise — build Phases 1–4 and 6 first.

---

## PHASE 1 — Foundation
**Build:** App foundation, branding/navigation, secure login with MFA, team roles (solo today, scalable to developers/contractors), client and customer directory (with relationship_type computed from active projects and/or subscriptions), product catalog setup.

**Done when:** the system can distinguish a dev-services-only account, a product-customer-only account, and an account that's both — without three separate data models.

---

## PHASE 2 — Custom Development Services
**Build:** Lead capture and discovery, project scoping and proposal generator (fixed bid vs. time & materials per spec Section 4.2), project and sprint management, requirements/spec repository, client review and deliverable sign-off (required before invoicing, spec Section 4.3), project billing.

**Done when:** a milestone cannot be invoiced without a recorded client sign-off, and a fixed-bid project's milestones sum to the total proposal amount.

---

## PHASE 3 — Productized Software
**Build:** Product listings and pricing tiers, customer subscription and license management, provisioning and access control (automatic on activation, not manual — spec Section 5.2), renewal/upgrade/downgrade handling, product usage tracking (seat-based or usage-based depending on the product), product support ticket system with an "outside_scope" flag.

**Done when:** access provisions automatically the moment a subscription becomes active, and revokes automatically (not deletes) on cancellation.

---

## PHASE 4 — Unified CRM and Billing
**Build:** Unified client/customer 360 view spanning both dev projects and subscriptions, cross-sell detection (spec Section 2.3 — product support tickets flagged outside_scope suggest a dev services opportunity; dev projects resembling existing products suggest a product fit), unified invoicing across both billing types, revenue reporting split by line.

**Done when:** a client with both an active dev project and an active subscription shows one unified account view, but their dev project revenue and subscription revenue report as two separate numbers, never combined.

---

## PHASE 5 — Information Systems Monitoring (FUTURE — DO NOT BUILD YET)
**Scoped for later:** monitoring account setup, uptime/performance dashboard, security/vulnerability alerts, incident tracking, SLA tracking and reporting, recurring monitoring service billing. Full logic is in Technical Specification Section 6.

**Do not build this phase during initial development.** It's documented here so the schema (monitored_systems table, Sec. 3.8) doesn't need to be retrofitted later, but implementation waits for explicit go-ahead.

---

## PHASE 6 — Reporting, Security, Launch
**Build:** Practice-wide revenue reporting (dev services vs. product vs. future monitoring, kept separate), team utilization/capacity reporting, AI assistant, full security hardening per spec Section 7, testing pass, production launch.

**Done when:** every report is a read-only rollup off Projects/Subscriptions/Invoices, and revenue-by-line reporting is ready to add a monitoring category later without restructuring.

---

## Build Order Rules

1. **Do not merge dev_projects and subscriptions into one table**, even though they'll sometimes belong to the same account. They have different lifecycles, different billing logic, and different failure modes.
2. **Do not build Phase 5 (Monitoring) as part of the initial launch.** It's scoped, not commissioned yet.
3. **Do not let an invoice's source_id be ambiguous** — it must clearly point to either a specific milestone, a block of logged hours, or a specific subscription, never a bare account_id.
4. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation | 1–6 | Not started | |
| 2 — Custom Development Services | 7–12 | Not started | |
| 3 — Productized Software | 13–18 | Not started | |
| 4 — Unified CRM and Billing | 19–22 | Not started | |
| 5 — Information Systems Monitoring | 23–28 | Deferred | Scoped only — do not build without explicit go-ahead |
| 6 — Reporting, Security, Launch | 29–33 | Not started | |
