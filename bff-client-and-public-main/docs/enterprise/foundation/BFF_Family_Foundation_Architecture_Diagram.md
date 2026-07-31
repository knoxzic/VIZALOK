# BFF Family Foundation™ — Master Prompt Architecture (Prompts 1–30)

Scope: a private 501(c)(3) foundation's own grant-*making* platform — the inverse of every other BFF platform, which helps clients seek or manage grants/funding. This one manages the Foundation's own endowment, publishes guidelines, receives applications from outside nonprofits, and distributes grants under IRS private foundation rules.

Confirmed structure: Private Foundation under IRC §501(c)(3). Minimum 5% annual distribution of net investment assets (IRC §4942). Funded by 10% of annual enterprise distributions plus family gifts and public contributions. Foundation Board: 2 family members + 1 community member + 1 nonprofit sector professional. Form 990-PF filed annually by BFF Grant & Nonprofit Solutions. Focus areas: financial literacy education, childcare access, community development, historic preservation. Grant range: $5,000–$50,000 initially. Annual cycle with published guidelines and a community review committee.

```mermaid
flowchart TB

A([BFF Family Foundation™]) --> P1

%% =====================================================
%% PHASE 1 — FOUNDATION AND GOVERNANCE
%% =====================================================
subgraph PHASE1["PHASE 1 — FOUNDATION AND GOVERNANCE"]
direction TB
P1["Prompt 1<br/>Create App Foundation"]
P2["Prompt 2<br/>Branding, Colors and Navigation"]
P3["Prompt 3<br/>Secure Login and MFA"]
P4["Prompt 4<br/>Board and Review Committee Roles<br/>(2 family + 1 community + 1 nonprofit professional)"]
P5["Prompt 5<br/>Endowment and Investment Asset Tracking<br/>(drives the 5% distribution calc)"]
P6["Prompt 6<br/>Grant Focus Area and Guidelines Configuration"]
P1 --> P2 --> P3 --> P4 --> P5 --> P6
end

%% =====================================================
%% PHASE 2 — GRANT APPLICATION INTAKE
%% =====================================================
subgraph PHASE2["PHASE 2 — GRANT APPLICATION INTAKE"]
direction TB
P7["Prompt 7<br/>Public Grant Guidelines Portal"]
P8["Prompt 8<br/>Grant Application Intake Form"]
P9["Prompt 9<br/>Applicant 501(c)(3)/EIN Verification"]
P10["Prompt 10<br/>Application Completeness Check"]
P11["Prompt 11<br/>Application Assignment to Review Committee"]
P12["Prompt 12<br/>Applicant Communication and Status Tracking"]
P7 --> P8 --> P9 --> P10 --> P11 --> P12
end
P6 --> P7

%% =====================================================
%% PHASE 3 — REVIEW AND AWARD DECISION
%% =====================================================
subgraph PHASE3["PHASE 3 — REVIEW AND AWARD DECISION"]
direction TB
P13["Prompt 13<br/>Community Review Committee Scoring Rubric"]
P14["Prompt 14<br/>Review Committee Deliberation and Recommendation"]
P15["Prompt 15<br/>Foundation Board Approval Workflow"]
P16["Prompt 16<br/>Award Letter and Grant Agreement Generation"]
P17["Prompt 17<br/>Declined Application Notification"]
P18["Prompt 18<br/>Conflict of Interest Check<br/>(family board member recusal)"]
P13 --> P14 --> P15 --> P16 --> P17 --> P18
end
P12 --> P13

%% =====================================================
%% PHASE 4 — DISTRIBUTION AND COMPLIANCE
%% =====================================================
subgraph PHASE4["PHASE 4 — DISTRIBUTION AND COMPLIANCE"]
direction TB
P19["Prompt 19<br/>5% Minimum Distribution Calculation and Tracking<br/>(IRC §4942)"]
P20["Prompt 20<br/>Grant Payment and Disbursement Processing"]
P21["Prompt 21<br/>Expenditure Responsibility Tracking<br/>(IRC §4945, non-public-charity grantees)"]
P22["Prompt 22<br/>Grantee Reporting Requirements"]
P23["Prompt 23<br/>Grant Compliance Monitoring"]
P19 --> P20 --> P21 --> P22 --> P23
end
P18 --> P19

%% =====================================================
%% PHASE 5 — REPORTING AND TRANSPARENCY
%% =====================================================
subgraph PHASE5["PHASE 5 — REPORTING AND TRANSPARENCY"]
direction TB
P24["Prompt 24<br/>Form 990-PF Data Preparation"]
P25["Prompt 25<br/>Public Disclosure Requirements"]
P26["Prompt 26<br/>Annual Report Generation<br/>(for family and board)"]
P27["Prompt 27<br/>Grant Impact and Outcomes Tracking"]
P24 --> P25 --> P26 --> P27
end
P23 --> P24

%% =====================================================
%% PHASE 6 — AI, SECURITY, LAUNCH
%% =====================================================
subgraph PHASE6["PHASE 6 — AI, SECURITY, LAUNCH"]
direction TB
P28["Prompt 28<br/>Gigi — GG AI Concierge Integration"]
P29["Prompt 29<br/>Security Architecture"]
P30["Prompt 30<br/>Testing and Launch"]
P28 --> P29 --> P30
end
P27 --> P28

LAUNCH([BFF Family Foundation™ Ready for Launch])
P30 --> LAUNCH

%% =====================================================
%% CORE DATABASE
%% =====================================================
subgraph DATABASE["CORE DATABASE"]
direction LR
DB1[(Board/Committee Members)]
DB2[(Endowment/Investment Assets)]
DB3[(Grant Cycles/Guidelines)]
DB4[(Grant Applications)]
DB5[(Application Reviews/Scores)]
DB6[(Grants Awarded)]
DB7[(Disbursements)]
DB8[(Grantee Reports)]
DB9[(Conflicts of Interest Log)]
DB10[(Audit Log)]
end

P4 --> DB1
P5 --> DB2
P6 --> DB3
P8 --> DB4
P13 --> DB5
P16 --> DB6
P20 --> DB7
P22 --> DB8
P18 --> DB9
P29 --> DB10

classDef start fill:#1B4332,color:#FFFFFF,stroke:#C9A227,stroke-width:4px;
classDef prompt fill:#F8D9E5,color:#222222,stroke:#1B4332,stroke-width:2px;
classDef database fill:#F3F3F3,color:#222222,stroke:#555555,stroke-width:1px;
classDef launch fill:#DCEEDC,color:#1B4332,stroke:#1B4332,stroke-width:4px;
class A start;
class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,P16,P17,P18,P19,P20,P21,P22,P23,P24,P25,P26,P27,P28,P29,P30 prompt;
class DB1,DB2,DB3,DB4,DB5,DB6,DB7,DB8,DB9,DB10 database;
class LAUNCH launch;
```

## The Accuracy Spine — Applied to Federal Excise Tax Exposure

Every other BFF platform protects a client's number. This one protects the Foundation itself from federal penalty excise taxes. The 5% minimum distribution requirement (IRC §4942) isn't a best practice — falling short triggers a 30% excise tax on the undistributed amount, and it compounds if uncorrected. Every grant tracks toward this running total in real time, not just at year-end when it's too late to course-correct.

## Why This Is a Different Shape Than Every Other BFF Platform

Every other platform in this suite helps a client get money (grants, insurance payouts, client billing) or track money they've spent. This platform gives money away, under a body of tax law that penalizes giving away *too little*, not too much. That inversion is why Phase 4 (Distribution and Compliance) exists as its own phase rather than being folded into generic "billing," and why self-dealing and expenditure responsibility get their own compliance gates in the Technical Specification.
