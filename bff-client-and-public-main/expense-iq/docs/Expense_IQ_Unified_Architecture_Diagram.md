# Expense IQ™ — Unified System Architecture Diagram (Corrected)

This replaces the two earlier diagrams with one accurate picture: every capture source — receipts, bank imports, mileage, travel, reimbursements — funnels through the **same** extraction → validation → categorization → posting pipeline into **one** central Ledger, mapped to **one** Chart of Accounts. Nothing bypasses this spine. Security and role-based access wrap the whole system, not just the login screen.

This matches Sections 2, 6, and 8 of the Technical Specification.

```mermaid
flowchart TB

%% =====================================================
%% ENTRY / AUTH
%% =====================================================
START([Open Expense IQ]) --> AUTH[Secure Login + MFA]
AUTH --> ORG[Organization Context Loaded<br/>org_id scopes every query]
ORG --> ROLE{Role Check}
ROLE --> R1[Owner]
ROLE --> R2[Bookkeeper]
ROLE --> R3[Tax Professional]
ROLE --> R4[Grant Manager]
ROLE --> R5[Employee]
ROLE --> R6[Read Only]
R1 & R2 & R3 & R4 & R5 & R6 --> DASH[Dashboard]

%% =====================================================
%% CAPTURE SOURCES — all roads lead to the same pipeline
%% =====================================================
subgraph CAPTURE["CAPTURE SOURCES"]
direction LR
C1[Camera]
C2[File Upload<br/>PDF/JPG/PNG/HEIC]
C3[Bulk Upload]
C4[Email-In]
C5[Bank/CSV Import]
C6[Manual Entry]
C7[Mileage Trip Logged]
C8[Travel Event Entered]
C9[Reimbursement Request]
end

DASH --> CAPTURE

C1 --> OCR
C2 --> OCR
C3 --> OCR
C4 --> OCR
C5 --> NORM
C6 --> NORM
C7 --> MCALC
C8 --> TCALC
C9 --> NORM

%% =====================================================
%% EXTRACTION
%% =====================================================
OCR["OCR & AI Extraction<br/>Vendor · Date · Subtotal · Tax · Tip · Total · Payment · Receipt#"] --> CONF{Confidence Score}
CONF -->|"≥ 0.85"| DUP
CONF -->|"0.60 – 0.84"| PARTIAL[Auto-populate<br/>Flag low-confidence fields]
CONF -->|"< 0.60"| REVIEW[Human Review Queue]
PARTIAL --> DUP
REVIEW --> LEARN[Correction Saved<br/>Vendor Pattern Learning]
LEARN --> DUP

MCALC["Mileage Calc<br/>miles × IRS rate for trip year"] --> NORM
TCALC["Travel Line Costing<br/>per-line amount, meals 50% rule applied"] --> NORM
NORM[Normalize to Transaction Draft] --> DUP

DUP{Duplicate Detection<br/>vendor + date ± 2d + amount} -->|Match| FLAG[Flag for Review<br/>does not auto-post]
DUP -->|No Match| CAT

%% =====================================================
%% CATEGORIZATION — strict priority order
%% =====================================================
CAT["AI Categorization Engine"] --> CP1{"1. Vendor Rule exists?"}
CP1 -->|Yes| ASSIGN
CP1 -->|No| CP2{"2. Prior user decision<br/>for similar vendor/amount?"}
CP2 -->|Yes| ASSIGN
CP2 -->|No| CP3{"3. Grant budget<br/>line match?"}
CP3 -->|Yes| ASSIGN
CP3 -->|No| CP4{"4. AI model suggestion?"}
CP4 -->|Yes, user confirms| ASSIGN
CP4 -->|No confident match| REVIEW

ASSIGN[Assign Chart of Accounts Code] --> OVERLAY[Program / Client / Grant / Fund Overlay<br/>if applicable]

%% =====================================================
%% VALIDATION GATE — nothing posts without clearing this
%% =====================================================
OVERLAY --> GATE{{"VALIDATION GATE"}}
GATE --> V1["Missing Receipt Check"]
GATE --> V2["Amount Mismatch Check<br/>Subtotal+Tax+Tip = Total"]
GATE --> V3["Date Conflict Check<br/>vs. locked periods"]
GATE --> V4["Personal Expense Risk"]
GATE --> V5["Grant Allowability Check"]
GATE --> V6["Uncategorized Check — hard block"]

V5 --> ALLOW{Allowable?}
ALLOW -->|No| WARN[Compliance Warning<br/>blocks posting, data retained]
ALLOW -->|Yes| BUDGET{Budget Exceeded?}
BUDGET -->|Yes| ALERT[Overspend Alert to Grant Manager]
BUDGET -->|No| BURN[Update Burn Rate]

V1 & V2 & V3 & V4 & V6 & BURN & ALERT --> APPR{Approval Required?}
APPR -->|Yes| MGRAPPR[Manager Approval]
APPR -->|No| POST
MGRAPPR --> POST

%% =====================================================
%% POST — the one write path
%% =====================================================
POST["POST TRANSACTION<br/>Atomic write: transaction + coa_id"] --> LEDGER[("CENTRAL LEDGER<br/>transactions table")]

%% =====================================================
%% CHART OF ACCOUNTS
%% =====================================================
LEDGER --> COA{{"Chart of Accounts<br/>SMB or Nonprofit Template"}}
COA --> COA1["Schedule C Line Mapping"]
COA --> COA2["Form 990 Function Mapping"]

%% =====================================================
%% DOWNSTREAM — read-only consumers, never write back
%% =====================================================
LEDGER --> OUT1[Executive Dashboard]
LEDGER --> OUT2[P&L / Balance Sheet / Cash Flow]
LEDGER --> OUT3[Schedule C Summary]
LEDGER --> OUT4[Form 990 Part IX]
LEDGER --> OUT5[Grant Budget vs Actual]
LEDGER --> OUT6[IRS Mileage Log]
LEDGER --> OUT7[Vendor / 1099 Reports]
LEDGER --> OUT8[Gigi AI Assistant — read-only insights]
LEDGER --> OUT9[Export Center<br/>PDF / Excel / CSV / Packages]

FLAG --> REVIEW

%% =====================================================
%% SECURITY — wraps every step above
%% =====================================================
subgraph SECURITY["SECURITY & COMPLIANCE — cross-cutting, not a separate module"]
direction LR
S1[Encryption at rest + in transit]
S2[Role-Based Access — enforced at API layer]
S3[Org Data Isolation via org_id]
S4[Immutable Audit Log<br/>every post/edit/approve/export]
S5[Automated Backups]
end

AUTH -.-> SECURITY
POST -.-> S4
GATE -.-> S2
LEDGER -.-> S3

%% =====================================================
%% STYLES — BFF Brand
%% =====================================================
classDef start fill:#1B4332,color:#FFFFFF,stroke:#C9A227,stroke-width:4px;
classDef capture fill:#F8D9E5,color:#222222,stroke:#1B4332,stroke-width:2px;
classDef process fill:#FFF4CC,color:#222222,stroke:#C9A227,stroke-width:1px;
classDef decision fill:#F7E1D3,color:#4A2500,stroke:#B76500,stroke-width:2px;
classDef gate fill:#E85D8F,color:#FFFFFF,stroke:#1B4332,stroke-width:3px;
classDef ledger fill:#1B4332,color:#FFFFFF,stroke:#C9A227,stroke-width:4px;
classDef output fill:#DCEEDC,color:#1B4332,stroke:#1B4332,stroke-width:1px;
classDef security fill:#F3F3F3,color:#222222,stroke:#555555,stroke-width:1px;
classDef warn fill:#FCE4E4,color:#7A1F1F,stroke:#B33A3A,stroke-width:2px;

class START,DASH start;
class C1,C2,C3,C4,C5,C6,C7,C8,C9 capture;
class OCR,PARTIAL,REVIEW,LEARN,MCALC,TCALC,NORM,CAT,ASSIGN,OVERLAY,POST process;
class CONF,ROLE,DUP,CP1,CP2,CP3,CP4,ALLOW,BUDGET,APPR decision;
class GATE gate;
class LEDGER,COA ledger;
class OUT1,OUT2,OUT3,OUT4,OUT5,OUT6,OUT7,OUT8,OUT9,COA1,COA2 output;
class S1,S2,S3,S4,S5 security;
class FLAG,WARN,ALERT warn;
```

---

## What Changed From the Two Earlier Diagrams

| Before | Now |
|---|---|
| Two separate diagrams (build-order vs. runtime) with no explicit shared spine | One diagram — every capture source visibly converges on the same pipeline before reaching the Ledger |
| Categorization shown as a single box | Categorization shown as the actual 4-tier priority decision (vendor rule → prior decision → grant match → AI model → fallback to review) |
| Validation checks listed as flat sibling nodes | Validation shown as a true gate — nothing reaches POST without clearing it, including the allowability/budget sub-logic |
| Mileage/Travel drawn as side modules feeding "reports" | Mileage/Travel shown feeding the *same* pipeline as receipts — because they're transactions, not just logs |
| Security drawn as one Phase-33 box at the end | Security shown as a cross-cutting layer (dashed lines) touching Auth, the Validation Gate, Posting, and the Ledger — not a bolt-on at launch |

This is the diagram to hand to Grok alongside the Technical Specification — it's the visual form of Sections 2 and 6.
