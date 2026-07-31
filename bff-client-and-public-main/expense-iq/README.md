# Expense IQ™

Multi-tenant financial management platform for small businesses, nonprofits, and grant-funded organizations.  
**Best Face Forward Consultants, LLC · G&G Software Solutions**

> **The one rule:** every dollar, from any source, must resolve to **exactly one** row in `transactions`, mapped to **exactly one** Chart of Accounts code, before it is considered posted.

## Status

| Phase | Scope | Status |
|-------|--------|--------|
| **1 — App foundation** | Auth, MFA (demo), orgs, roles, multi-org, `org_id` scope | **In progress / demoable** |
| 2 — Capture & dashboard | OCR, review queue | Shell only |
| 3 — Transactions & COA | Ledger pipeline, validation gate | Shell only |
| 4 — Grants, mileage, travel | Same pipeline as receipts | Shell only |
| 5 — Reports, Gigi, security hard | Read-only rollups, launch | Shell only |

Spec sources (kept with the product package):

- `Expense_IQ_Technical_Specification.docx`
- `Expense_IQ_Unified_Architecture_Diagram.md`
- `Expense_IQ_Interactive_Pipeline.html`
- `Expense_IQ_Grok_Roadmap.md`

## Run locally (no API keys, no billing)

```powershell
cd "C:\Users\scoob\Downloads\New BFF\expense-iq"
npx --yes serve .
```

Or open `index.html` directly in a browser (localStorage works offline).

### Quick walkthrough

1. **Create account** → demo MFA code for Owner path → **create organization** (SMB or Nonprofit COA template).
2. Land on **Dashboard** — pipeline spine visible; KPIs placeholder-safe.
3. **Organization** — edit profile / COA template (Owner).
4. **Admin** — members, invite by email (user must register first in this browser), permission matrix, audit log.
5. Create a **second org** from Organization → switch with the top bar.

Data is stored in **this browser only** (`localStorage` key `eiq_v1`).

## Repo / domain plan

- This folder is self-contained: copy `expense-iq/` to its own GitHub repo when ready.
- Point a custom domain at static hosting (GitHub Pages, Cloudflare Pages, Netlify, Firebase Hosting).
- Later: set `EIQ.config.STORAGE_MODE` to `firebase` or `supabase` and replace `js/db.js` methods with the same signatures (keep `org_id` on every query).

## Architecture (runtime spine)

```
Capture → Extract/Normalize → Deduplicate → Categorize → Validation Gate → POST (transactions + coa_id) → Ledger
                                                                                              ↓
                                                                                    Dashboard / Reports / Gigi (read-only)
```

## Phase 1 “done when” checklist

- [x] Register / login (local demo auth)
- [x] MFA enforced for Owner & Bookkeeper (demo 6-digit code)
- [x] Create org + `coa_template` smb | nonprofit
- [x] Multi-org membership + switcher
- [x] Roles + permission matrix scaffolding
- [x] Every data list path requires `org_id` (`EIQ.db.scoped`)
- [x] Immutable-style audit log append
- [ ] Production auth provider (Firebase / Supabase Auth)
- [ ] Real TOTP / SMS MFA

## Linked from BFF marketing site

- Software portal → Open Expense IQ  
- Financial portal → Resource: Expense IQ  

## Brand

Forest green `#1B4332` · Gold `#C9A227` · Hot pink `#E85D8F` (product spec palette).
