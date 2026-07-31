# Expense IQ™ — Development Roadmap for Grok
**Copy everything below this line directly into Grok as your build instructions.**

---

You are the lead developer building **Expense IQ™**, a multi-tenant financial management platform for small businesses, nonprofits, and grant-funded organizations.

You have three reference documents to work from, provided separately:
1. **Technical Specification** — database schema, OCR/AI logic, categorization rules, posting rules, security architecture, screen inventory, permission matrix.
2. **Unified Architecture Diagram** — the visual flow showing how every capture source (receipts, bank imports, mileage, travel, reimbursements) funnels through one pipeline into one Ledger.
3. **This Roadmap** — the build order, phase by phase, with what "done" means at each phase.

Treat all three as one spec. If anything conflicts between them, stop and ask before proceeding — do not guess.

**The one rule that governs every phase below:** every dollar, from any source, must resolve to exactly one row in the `transactions` table, mapped to exactly one Chart of Accounts code, before it is considered posted. No phase is complete if it introduces a path that bypasses this.

---

## PHASE 1 — App Foundation
**Build:**
- Multi-tenant org structure (`organizations`, `users`, `roles` tables)
- Secure registration/login with MFA enforced for Owner and Bookkeeper roles
- Role-based permission scaffolding (Owner, Bookkeeper, Tax Professional, Grant Manager, Employee, Read Only) — enforce at the API layer, not just the UI
- Business/nonprofit organization profile setup, including `coa_template` selection (smb vs. nonprofit)
- Multi-organization switching for users who belong to more than one org

**Phase 1 is done when:** a user can register, enable MFA, create an org, select SMB or Nonprofit as their Chart of Accounts template, and switch between multiple orgs — with every API call correctly scoped by `org_id`.

---

## PHASE 2 — Receipt Capture & Dashboard
**Build:**
- Executive Dashboard shell (Income, Expenses, Net Cash Flow, Missing Receipts, Transactions Needing Review, Mileage, Grant Funds Remaining, Tax Readiness Score — wired to real data once Phase 3 exists, placeholder-safe until then)
- Capture sources: camera, file upload (PDF/JPG/PNG/HEIC), bulk upload, email-in
- OCR & AI Extraction Engine per spec Section 4 — extract Vendor, Date, Subtotal, Tax, Tip, Total, Payment Method, Receipt Number
- Confidence scoring per the formula in spec Section 4.3, with routing at the ≥0.85 / 0.60–0.84 / <0.60 thresholds
- Duplicate detection (vendor + date ±2 days + amount fuzzy match)
- Human Review Queue with Approve / Edit / Reject / Request Documentation actions
- Correction feedback loop: saved corrections improve vendor-specific extraction over time

**Phase 2 is done when:** a receipt captured by any method is OCR'd, confidence-scored, checked for duplicates, and either auto-populated or routed to review — with every correction logged for learning.

---

## PHASE 3 — Transactions & Accounting
**Build:**
- Transaction Register supporting Income, Expense, Transfer, Refund, Reimbursement, Owner Contribution, Owner Draw
- Manual entry, CSV import, bank import, credit card import
- Chart of Accounts — both SMB template (Assets/Liabilities/Equity/Income/COGS/Op.Exp/Other) and Nonprofit template (Assets/Liabilities/Revenue & Support/Program/M&G/Fundraising/Restricted & Unrestricted Net Assets)
- AI Categorization Engine per spec Section 5 — strict priority order: Vendor Rule → Prior User Decision → Grant Budget Line Match → AI Model Suggestion → fallback to Review Queue (never auto-post uncategorized)
- Tax/report mapping: account → Schedule C line, account → Form 990 function, transaction → grant/client/project/program/fund
- Validation Gate per spec Section 6.4: missing receipt check, duplicate check, amount mismatch check, date conflict check, personal expense risk, uncategorized hard block
- Reconciliation and period close workflow (import → match → categorize → resolve exceptions → reconcile → review → lock period → archive)

**Phase 3 is done when:** a transaction from any source posts through the full pipeline in the Unified Architecture Diagram — extraction/normalize → duplicate check → categorize → validate → post — landing in the Ledger with a Chart of Accounts code, with zero paths that skip the Validation Gate.

---

## PHASE 4 — Supporting Financial Modules
**Build:**
- Vendor management: directory, contact info, default category, W-9 status, 1099 threshold tracking, vendor expense report
- Client/project tracking: directory, project budgets, billable vs. non-billable split, client reimbursement report, project profitability
- Grant and restricted fund tracking: grant profile, funder, award amount, period, approved budget, budget line items, allowable costs, restricted funds, match requirement, indirect cost rate, remaining balance, burn rate, reporting deadlines, closeout — including the Allowable/Budget Exceeded decision logic in spec Section 6.3
- Mileage: vehicle profiles, trip logging (date, start/destination, business purpose, odometer or GPS), IRS mileage rate lookup by year, deduction calculation, parking/tolls as separate line items, IRS-compliant mileage log export
- Travel: multi-day travel events (traveler, purpose, destination, dates), airfare, lodging, meals (with 50% deductibility rule applied at categorization), per diem, transportation, mileage, travel expense report
- Reimbursements: employee, owner, client, and grant reimbursement types, with approval workflow and payment status

**Phase 4 is done when:** mileage trips and travel expenses post into the Ledger exactly like receipts do — same validation, same Chart of Accounts mapping — not as standalone logs that only produce a report at tax time.

---

## PHASE 5 — Reporting, Tax Readiness, Security & Launch
**Build:**
- Financial Report Center: P&L, Balance Sheet, Cash Flow, General Ledger, Transaction Detail, Budget vs. Actual, Missing Receipt Report, Reconciliation Report — every report is a read-only rollup off `transactions`, never its own calculation logic
- Schedule C Summary (mapped from `chart_of_accounts.schedule_c_line`)
- Form 990 Part IX / Statement of Functional Expenses (mapped from `chart_of_accounts.form_990_function`)
- Grant, vendor, client, mileage, and travel specialized reports
- Export Center: PDF, Excel, CSV, Receipt Archive, Tax Professional Package, Bookkeeper Package, Grant Audit Package, Board Package, filtered date-range export
- Gigi AI Assistant: natural-language Q&A over financial data, spending/cash flow/tax/grant insights — read-only, never writes to `transactions`
- Security hardening per spec Section 8: encryption at rest/in transit, MFA, RBAC, org data isolation, immutable audit log, automated backups, 7-year data retention, security monitoring
- Full test pass: functional, calculation accuracy, permission enforcement, mobile, report accuracy, security, user acceptance
- Production launch

**Phase 5 is done when:** every report, export, and AI insight is demonstrably read-only against the Ledger, security controls from Section 8 are verifiably in place (not just documented), and the full test pass has run clean.

---

## Build Order Rules

1. **Do not start a phase's UI work before its data model exists.** Build the tables in the Technical Specification's Section 3 before the screens in Section 9 that read from them.
2. **Do not let any phase introduce a second write path to `transactions`.** If a feature seems to need one (e.g., a "quick log" shortcut), route it through the same posting pipeline instead of adding a shortcut.
3. **After each phase, report back against this roadmap** — what was built, what's deferred, and any place where the phase's actual output diverged from this document or the Technical Specification. Flag divergence; don't silently resolve it.
4. **If a requirement in this roadmap conflicts with something faster or simpler to build, default to this roadmap** unless told otherwise — the point of this spec is that the numbers stay trustworthy even when that costs extra engineering effort.

---

## Progress Tracking Table (update this as you go)

| Phase | Prompts Covered | Status | Notes |
|---|---|---|---|
| 1 — App Foundation | 1–6 | Not started | |
| 2 — Capture & Dashboard | 7–13 | Not started | |
| 3 — Transactions & Accounting | 14–21 | Not started | |
| 4 — Supporting Modules | 22–27 | Not started | |
| 5 — Reporting, Security, Launch | 28–33 | Not started | |
