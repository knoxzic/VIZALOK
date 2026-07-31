# BFF Insurance Solutions™ — Master Prompt Architecture (Prompts 1–33)

Scope confirmed: full lifecycle (lead generation → quoting → policy/client management → commissions → client portal), solo producer today with multi-agent-ready architecture, all lines of insurance (life, health, P&C — built to scale as licensing expands).

```mermaid
flowchart TB

A([BFF Insurance Solutions™]) --> P1

%% =====================================================
%% PHASE 1 — FOUNDATION AND COMPLIANCE
%% =====================================================
subgraph PHASE1["PHASE 1 — FOUNDATION AND COMPLIANCE"]
direction TB
P1["Prompt 1<br/>Create App Foundation"]
P2["Prompt 2<br/>Branding, Colors and Navigation"]
P3["Prompt 3<br/>Secure Login and MFA"]
P4["Prompt 4<br/>Agent Roles and Permissions<br/>(solo-ready, multi-agent-capable)"]
P5["Prompt 5<br/>Producer License and Appointment Tracking"]
P6["Prompt 6<br/>Carrier and Product Directory"]
P1 --> P2 --> P3 --> P4 --> P5 --> P6
end

%% =====================================================
%% PHASE 2 — LEAD GENERATION AND QUOTING
%% =====================================================
subgraph PHASE2["PHASE 2 — LEAD GENERATION AND QUOTING"]
direction TB
P7["Prompt 7<br/>Lead Capture"]
P8["Prompt 8<br/>Lead Scoring and Pipeline"]
P9["Prompt 9<br/>Multi-Line Quoting Engine"]
P10["Prompt 10<br/>Quote Comparison"]
P11["Prompt 11<br/>Needs Analysis and Coverage Gap Tools"]
P12["Prompt 12<br/>Lead-to-Client Conversion Workflow"]
P7 --> P8 --> P9 --> P10 --> P11 --> P12
end
P6 --> P7

%% =====================================================
%% PHASE 3 — POLICY AND CLIENT MANAGEMENT (CRM)
%% =====================================================
subgraph PHASE3["PHASE 3 — POLICY AND CLIENT MANAGEMENT"]
direction TB
P13["Prompt 13<br/>Client Directory and Household Profiles"]
P14["Prompt 14<br/>Policy Register — All Lines"]
P15["Prompt 15<br/>Beneficiary and Dependent Tracking"]
P16["Prompt 16<br/>Renewal and Anniversary Alerts"]
P17["Prompt 17<br/>Cross-Sell and Coverage Gap Detection"]
P18["Prompt 18<br/>Policy Change and Endorsement Log"]
P13 --> P14 --> P15 --> P16 --> P17 --> P18
end
P12 --> P13

%% =====================================================
%% PHASE 4 — APPLICATIONS, UNDERWRITING AND COMMISSIONS
%% =====================================================
subgraph PHASE4["PHASE 4 — APPLICATIONS, UNDERWRITING, COMMISSIONS"]
direction TB
P19["Prompt 19<br/>Application Submission and E-Signature"]
P20["Prompt 20<br/>Underwriting Status Tracking"]
P21["Prompt 21<br/>Commission Schedule Setup"]
P22["Prompt 22<br/>Commission Calculation and Reconciliation"]
P23["Prompt 23<br/>Chargeback and Lapse Handling"]
P19 --> P20 --> P21 --> P22 --> P23
end
P18 --> P19

%% =====================================================
%% PHASE 5 — CLIENT PORTAL
%% =====================================================
subgraph PHASE5["PHASE 5 — CLIENT PORTAL"]
direction TB
P24["Prompt 24<br/>Client Self-Service Login"]
P25["Prompt 25<br/>Policy and Document Access"]
P26["Prompt 26<br/>Claims Initiation and Status Tracking"]
P27["Prompt 27<br/>Secure Messaging"]
P24 --> P25 --> P26 --> P27
end
P23 --> P24

%% =====================================================
%% PHASE 6 — COMPLIANCE, REPORTING, SECURITY, LAUNCH
%% =====================================================
subgraph PHASE6["PHASE 6 — COMPLIANCE, REPORTING, SECURITY, LAUNCH"]
direction TB
P28["Prompt 28<br/>Compliance Dashboard<br/>(license, CE credits, E&O status)"]
P29["Prompt 29<br/>Production Reports"]
P30["Prompt 30<br/>Persistency and Retention Reports"]
P31["Prompt 31<br/>AI Assistant"]
P32["Prompt 32<br/>Security Architecture"]
P33["Prompt 33<br/>Testing and Launch"]
P28 --> P29 --> P30 --> P31 --> P32 --> P33
end
P27 --> P28

LAUNCH([BFF Insurance Solutions™ Ready for Launch])
P33 --> LAUNCH

%% =====================================================
%% CORE DATABASE
%% =====================================================
subgraph DATABASE["CORE DATABASE"]
direction LR
DB1[(Agents/Users)]
DB2[(Licenses and Appointments)]
DB3[(Carriers and Products)]
DB4[(Leads)]
DB5[(Quotes)]
DB6[(Clients/Households)]
DB7[(Policies)]
DB8[(Beneficiaries)]
DB9[(Applications)]
DB10[(Commissions)]
DB11[(Claims)]
DB12[(Audit Log)]
end

P3 --> DB1
P5 --> DB2
P6 --> DB3
P7 --> DB4
P9 --> DB5
P13 --> DB6
P14 --> DB7
P15 --> DB8
P19 --> DB9
P22 --> DB10
P26 --> DB11
P32 --> DB12

classDef start fill:#1B4332,color:#FFFFFF,stroke:#C9A227,stroke-width:4px;
classDef prompt fill:#F8D9E5,color:#222222,stroke:#1B4332,stroke-width:2px;
classDef database fill:#F3F3F3,color:#222222,stroke:#555555,stroke-width:1px;
classDef launch fill:#DCEEDC,color:#1B4332,stroke:#1B4332,stroke-width:4px;
class A start;
class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,P16,P17,P18,P19,P20,P21,P22,P23,P24,P25,P26,P27,P28,P29,P30,P31,P32,P33 prompt;
class DB1,DB2,DB3,DB4,DB5,DB6,DB7,DB8,DB9,DB10,DB11,DB12 database;
class LAUNCH launch;
```

## The Accuracy Spine (same principle as Expense IQ)

Every lead, quote, application, and policy must resolve to exactly one row in the **Policies** table (once bound) or **Leads/Quotes** table (pre-bind), tagged to exactly one Client/Household and one Carrier/Product — and every commission must trace back to exactly one bound policy. No module writes a production number directly into a report; every report reads from Policies + Commissions.
