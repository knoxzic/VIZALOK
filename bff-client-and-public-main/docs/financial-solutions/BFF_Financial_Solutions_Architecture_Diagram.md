# BFF Financial Solutions™ — Master Prompt Architecture (Prompts 1–33)

Scope confirmed: full financial consulting practice platform, solo today with scalable architecture, starting from zero clients, covering four service lines — bookkeeping/accounting, individual financial advisory, tax preparation, and business financial analysis/reporting.

```mermaid
flowchart TB

A([BFF Financial Solutions™]) --> P1

%% =====================================================
%% PHASE 1 — FOUNDATION AND COMPLIANCE
%% =====================================================
subgraph PHASE1["PHASE 1 — FOUNDATION AND COMPLIANCE"]
direction TB
P1["Prompt 1<br/>Create App Foundation"]
P2["Prompt 2<br/>Branding, Colors and Navigation"]
P3["Prompt 3<br/>Secure Login and MFA"]
P4["Prompt 4<br/>Consultant Roles and Permissions<br/>(solo-ready, multi-consultant-capable)"]
P5["Prompt 5<br/>Professional Credentials Tracking<br/>(GMCP, PTIN, Xero, CE)"]
P6["Prompt 6<br/>Client Type and Engagement Directory"]
P1 --> P2 --> P3 --> P4 --> P5 --> P6
end

%% =====================================================
%% PHASE 2 — LEAD GENERATION AND ENGAGEMENT INTAKE
%% =====================================================
subgraph PHASE2["PHASE 2 — LEAD GENERATION AND ENGAGEMENT INTAKE"]
direction TB
P7["Prompt 7<br/>Lead Capture"]
P8["Prompt 8<br/>Lead Scoring and Pipeline<br/>by Service Line Interest"]
P9["Prompt 9<br/>Discovery and Intake Questionnaire<br/>(varies by service line)"]
P10["Prompt 10<br/>Engagement Letter and Scope of Work Generator"]
P11["Prompt 11<br/>Fee Proposal and Pricing Engine<br/>(hourly / flat / retainer)"]
P12["Prompt 12<br/>Lead-to-Client Conversion Workflow"]
P7 --> P8 --> P9 --> P10 --> P11 --> P12
end
P6 --> P7

%% =====================================================
%% PHASE 3 — BOOKKEEPING AND ACCOUNTING MODULE
%% =====================================================
subgraph PHASE3["PHASE 3 — BOOKKEEPING AND ACCOUNTING MODULE"]
direction TB
P13["Prompt 13<br/>Client Chart of Accounts Setup<br/>(SMB or Nonprofit template)"]
P14["Prompt 14<br/>Transaction Import and Categorization<br/>(bank / Xero sync)"]
P15["Prompt 15<br/>Bookkeeping Cleanup Project Tracker"]
P16["Prompt 16<br/>Monthly Close Checklist and Reconciliation"]
P17["Prompt 17<br/>Financial Statement Generation"]
P18["Prompt 18<br/>Client Financial Health Dashboard"]
P13 --> P14 --> P15 --> P16 --> P17 --> P18
end
P12 --> P13

%% =====================================================
%% PHASE 4 — ADVISORY, TAX AND ANALYSIS
%% =====================================================
subgraph PHASE4["PHASE 4 — ADVISORY, TAX AND ANALYSIS"]
direction TB
P19["Prompt 19<br/>Individual Financial Planning Module"]
P20["Prompt 20<br/>Tax Prep Workflow<br/>(Form 8867 due diligence, filing tracker)"]
P21["Prompt 21<br/>Tax Deadline and Compliance Calendar"]
P22["Prompt 22<br/>Business Financial Analysis and KPI Reporting"]
P23["Prompt 23<br/>Advisory Session Notes and Recommendations Log"]
P19 --> P20 --> P21 --> P22 --> P23
end
P18 --> P19

%% =====================================================
%% PHASE 5 — CLIENT PORTAL AND BILLING
%% =====================================================
subgraph PHASE5["PHASE 5 — CLIENT PORTAL AND BILLING"]
direction TB
P24["Prompt 24<br/>Client Self-Service Portal"]
P25["Prompt 25<br/>Document Upload and E-Signature"]
P26["Prompt 26<br/>Invoicing and Billing<br/>(hourly / flat / retainer)"]
P27["Prompt 27<br/>Payment Processing and AR Tracking"]
P24 --> P25 --> P26 --> P27
end
P23 --> P24

%% =====================================================
%% PHASE 6 — COMPLIANCE, REPORTING, SECURITY, LAUNCH
%% =====================================================
subgraph PHASE6["PHASE 6 — COMPLIANCE, REPORTING, SECURITY, LAUNCH"]
direction TB
P28["Prompt 28<br/>Practice Compliance Dashboard<br/>(PTIN, GMCP CE, Xero cert)"]
P29["Prompt 29<br/>Practice-Wide Reporting<br/>(revenue by service line, utilization)"]
P30["Prompt 30<br/>Referral and Retention Reports"]
P31["Prompt 31<br/>AI Assistant"]
P32["Prompt 32<br/>Security Architecture"]
P33["Prompt 33<br/>Testing and Launch"]
P28 --> P29 --> P30 --> P31 --> P32 --> P33
end
P27 --> P28

%% =====================================================
%% PHASE 7 — TAX SOFTWARE AND SERVICE BUREAU SALES
%% =====================================================
subgraph PHASE7["PHASE 7 — TAX SOFTWARE AND SERVICE BUREAU SALES"]
direction TB
P34["Prompt 34<br/>Service Bureau Account Setup<br/>(vendor agreement, wholesale cost)"]
P35["Prompt 35<br/>Sub-Preparer Onboarding<br/>(EFIN/PTIN verification)"]
P36["Prompt 36<br/>Software License and Seat Management<br/>(per sub-preparer, per tax year)"]
P37["Prompt 37<br/>Revenue Share and Margin Calculation"]
P38["Prompt 38<br/>Sub-Preparer Production and Compliance Monitoring"]
P39["Prompt 39<br/>Service Bureau Billing and Renewal"]
P34 --> P35 --> P36 --> P37 --> P38 --> P39
end
P6 --> P34

LAUNCH([BFF Financial Solutions™ Ready for Launch])
P33 --> LAUNCH
P39 --> LAUNCH

%% =====================================================
%% CORE DATABASE
%% =====================================================
subgraph DATABASE["CORE DATABASE"]
direction LR
DB1[(Consultants/Users)]
DB2[(Credentials and CE)]
DB3[(Leads)]
DB4[(Engagements)]
DB5[(Clients)]
DB6[(Chart of Accounts — per client)]
DB7[(Transactions — per client)]
DB8[(Financial Plans)]
DB9[(Tax Returns)]
DB10[(Invoices/AR)]
DB11[(Documents)]
DB12[(Audit Log)]
DB13[(Sub-Preparers — wholesale, NOT clients)]
DB14[(Software Licenses/Seats)]
DB15[(Service Bureau Revenue)]
end

P35 --> DB13
P36 --> DB14
P37 --> DB15

P3 --> DB1
P5 --> DB2
P7 --> DB3
P10 --> DB4
P12 --> DB5
P13 --> DB6
P14 --> DB7
P19 --> DB8
P20 --> DB9
P26 --> DB10
P25 --> DB11
P32 --> DB12

classDef start fill:#1B4332,color:#FFFFFF,stroke:#C9A227,stroke-width:4px;
classDef prompt fill:#F8D9E5,color:#222222,stroke:#1B4332,stroke-width:2px;
classDef database fill:#F3F3F3,color:#222222,stroke:#555555,stroke-width:1px;
classDef launch fill:#DCEEDC,color:#1B4332,stroke:#1B4332,stroke-width:4px;
class A start;
class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,P16,P17,P18,P19,P20,P21,P22,P23,P24,P25,P26,P27,P28,P29,P30,P31,P32,P33,P34,P35,P36,P37,P38,P39 prompt;
class DB1,DB2,DB3,DB4,DB5,DB6,DB7,DB8,DB9,DB10,DB11,DB12,DB13,DB14,DB15 database;
class LAUNCH launch;
```

## The Accuracy Spine (same principle as Expense IQ and Insurance Solutions)

Every client transaction posts to exactly one Chart of Accounts code within that client's own ledger (Phase 3) — this deliberately reuses the same Ledger → Chart of Accounts discipline built for Expense IQ, so bookkeeping clients could eventually be migrated onto Expense IQ itself without a redesign. Every invoice traces back to exactly one engagement; every tax return traces back to exactly one client and one tax year. No module writes a financial fact directly into a report.

## Why Service Bureau Sales Is Its Own Phase, Not Folded Into Existing Modules

Sub-preparers who buy software seats through the service bureau are **wholesale software customers, not BFF clients** — they never touch the Clients/Engagements model in Phase 2, they don't get intake questionnaires, and their activity isn't a consulting engagement. Keeping Phase 7 structurally separate (its own tables: Sub-Preparers, Software Licenses, Service Bureau Revenue) prevents this fundamentally different B2B2B relationship from contaminating the "one client, four engagements" model built for the core practice.
