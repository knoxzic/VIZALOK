# BFF Logistics™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **BFF Logistics™**, a property preservation field services platform covering a multi-state territory (Virginia, Pennsylvania, Maryland, West Virginia, New Jersey), solo-ready today with architecture scalable to a network of field techs and subcontractors.

You have two reference documents, provided separately:
1. **Technical Specification** — the work order lifecycle, database schema, compliance/QC logic, field execution and dispatch logic, and billing/payout logic.
2. **Master Prompt Architecture Diagram** — the full build sequence across 6 phases, Prompts 1–33.

Treat both as one spec. If anything conflicts, stop and ask before proceeding.

**The one rule that governs every phase:** a work order cannot move to invoiced status without first passing QC review against its compliance checklist. Field completion alone is not sufficient — undocumented or non-compliant work is functionally unpaid work in this industry, and the platform exists to prevent that gap.

**Critical build note:** this is a field-first platform. Field techs will work in low-signal or rural areas across five states. Build the mobile checklist and photo capture (Phase 3) with offline-first behavior — data captured offline syncs on reconnect, work is never blocked waiting for a live connection.

---

## PHASE 1 — Foundation
**Build:** App foundation, branding/navigation, secure login with MFA, field tech and coordinator roles (solo today, scalable to a network), multi-state territory and coverage setup, client/vendor directory.

**Done when:** the system knows which states/counties/ZIPs are covered and by whom, and can distinguish client types (preservation company, bank, asset manager).

---

## PHASE 2 — Work Order Intake and Dispatch
**Build:** Work order intake (portal/email/API), classification against the service catalog, territory-based dispatch/assignment, deadline and priority tracking, bid submission workflow (for bid-required orders), acceptance/rejection.

**Done when:** an incoming work order is automatically classified, matched to a covering field tech by territory, and — if bid-required — cannot proceed past "assigned" until client approval is recorded.

---

## PHASE 3 — Field Execution and Documentation
**Build:** Mobile field checklist per service type, before/after photo capture with GPS/timestamp tagging (offline-capable, per the build note above), property condition documentation, time/materials logging, work order completion submission, rework/rejection handling.

**Done when:** a field tech can complete a full job offline and have it sync correctly on reconnect, with photos carrying the GPS/timestamp metadata required for QC.

---

## PHASE 4 — Compliance and Quality Control
**Build:** Investor guideline compliance checklist (FHA/HUD, Fannie Mae, Freddie Mac, client-specific — auto-selected per spec Section 4.1), photo/documentation QC review, compliance deadline tracking, field tech insurance/licensing tracking (spec Section 5.4 gate), chargeback and penalty tracking.

**Done when:** a work order cannot reach "qc_approved" status with missing checklist items or photos lacking GPS/timestamp metadata, and a subcontractor with expired insurance cannot be assigned new work.

---

## PHASE 5 — Billing and Payouts
**Build:** Client-specific line-item pricing (spec Section 6.1 — pricing varies by client, never a flat platform-wide list), invoice generation from QC-approved work orders only, payment/AR tracking, field tech/subcontractor payout tracking, payout reconciliation.

**Done when:** every invoice line item traces to a QC-approved work_order_id, and payout reconciliation catches any payout without a matching invoiced work order.

---

## PHASE 6 — Reporting, Security, Launch
**Build:** Work order status dashboard, client-facing reporting portal, AI assistant, full security hardening per spec Section 7, testing pass, production launch.

**Done when:** clients can see their own work order status in real time, and every report is a read-only rollup off Work Orders/Invoices/Payouts.

---

## Build Order Rules

1. **Do not let a work order reach "invoiced" status without passing QC (Phase 4).** This is the single most important gate in the entire system — it's the difference between billable and non-billable work in this industry.
2. **Do not build the field checklist as connection-dependent.** Offline-first is a requirement, not a nice-to-have, given the rural multi-state territory.
3. **Do not hardcode a single price list.** Client-specific pricing (Sec. 6.1) is fundamental to how this industry bills — every invoice calculation must reference the specific client's pricing schedule.
4. **After each phase, report back against this roadmap** — what was built, what's deferred, and any divergence from the Technical Specification. Flag it; don't silently resolve it.

---

## Progress Tracking Table

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — Foundation | 1–6 | Not started | |
| 2 — Work Order Intake and Dispatch | 7–12 | Not started | |
| 3 — Field Execution and Documentation | 13–18 | Not started | Build offline-first |
| 4 — Compliance and Quality Control | 19–23 | Not started | Highest-priority review before build |
| 5 — Billing and Payouts | 24–28 | Not started | |
| 6 — Reporting, Security, Launch | 29–33 | Not started | |
