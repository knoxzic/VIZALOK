/**
 * Expense IQ™ — config
 * STORAGE_MODE "supabase" uses shared BFF Supabase project (per-user org data + RLS).
 * Set to "local" for offline browser-only demos.
 */
window.EIQ = window.EIQ || {};

EIQ.config = {
  appName: "Expense IQ",
  tagline: "Compliant. Integrated. Accurate.",
  version: "0.2.0-supabase",
  brand: "Best Face Forward Consultants, LLC",

  /** local | supabase */
  STORAGE_MODE: "supabase",

  /**
   * Inherited from BFF.config.supabase when parent scripts load.
   * Fallback mirrors site keys for standalone expense-iq hosting.
   */
  supabase: {
    url: "https://rjxiytnoomgpodkpvxad.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqeGl5dG5vb21ncG9ka3B2eGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTM4MDIsImV4cCI6MjEwMTA4OTgwMn0.TGW9RWrru2cqMyr19QGA_biryvNuaW4CGNJOaF7ACHk",
    enabled: true,
  },

  /**
   * Soft MFA gate for owner/bookkeeper (profile flag).
   * Keep false — site-wide confirmed email is the mandatory gate (pages/auth.html).
   */
  REQUIRE_DEMO_MFA: false,

  storageKey: "eiq_v1",

  roles: [
    "owner",
    "bookkeeper",
    "tax_professional",
    "grant_manager",
    "employee",
    "read_only",
  ],

  /** MFA enforced for these roles (spec §8.1) */
  mfaRequiredRoles: ["owner", "bookkeeper"],

  orgTypes: [
    { value: "small_business", label: "Small Business" },
    { value: "nonprofit", label: "Nonprofit" },
    { value: "contractor", label: "Contractor" },
    { value: "daycare", label: "Daycare" },
    { value: "logistics", label: "Logistics" },
    { value: "insurance_agent", label: "Insurance Agent" },
  ],

  coaTemplates: [
    {
      value: "smb",
      label: "SMB (Schedule C)",
      blurb: "Assets · Liabilities · Equity · Income · COGS · Op.Exp · Other",
    },
    {
      value: "nonprofit",
      label: "Nonprofit (Form 990)",
      blurb: "Program · M&G · Fundraising · Restricted / Unrestricted Net Assets",
    },
  ],

  /**
   * Nav map matches spec §9.1 screen inventory.
   * phase: which roadmap phase unlocks real work (shell shows all).
   */
  nav: [
    { id: "dashboard", label: "Dashboard", icon: "◆", phase: 2, href: "#/dashboard" },
    { id: "capture", label: "Capture", icon: "◎", phase: 2, href: "#/capture" },
    { id: "transactions", label: "Transactions", icon: "☰", phase: 3, href: "#/transactions" },
    { id: "coa", label: "Chart of Accounts", icon: "⊞", phase: 3, href: "#/coa" },
    { id: "bank", label: "Bank & Reconcile", icon: "⇄", phase: 3, href: "#/bank" },
    { id: "grants", label: "Grants", icon: "◈", phase: 4, href: "#/grants" },
    { id: "mileage", label: "Mileage & Travel", icon: "→", phase: 4, href: "#/mileage" },
    { id: "vendors", label: "Vendors", icon: "◉", phase: 4, href: "#/vendors" },
    { id: "clients", label: "Clients & Projects", icon: "◇", phase: 4, href: "#/clients" },
    { id: "tax", label: "Tax Center", icon: "▣", phase: 5, href: "#/tax" },
    { id: "reports", label: "Reports & Exports", icon: "▥", phase: 5, href: "#/reports" },
    { id: "gigi", label: "Gigi Assistant", icon: "✦", phase: 5, href: "#/gigi" },
    { id: "admin", label: "Admin", icon: "⚙", phase: 1, href: "#/admin" },
    { id: "org", label: "Organization", icon: "⌂", phase: 1, href: "#/org" },
  ],

  /**
   * Permission matrix (spec §9.2) — simplified for Phase 1 scaffolding.
   * full | edit | view | own | grant | export | none
   */
  permissions: {
    transactions: {
      owner: "full",
      bookkeeper: "full",
      tax_professional: "export",
      grant_manager: "grant",
      employee: "own",
      read_only: "view",
    },
    chart_of_accounts: {
      owner: "full",
      bookkeeper: "edit",
      tax_professional: "view",
      grant_manager: "view",
      employee: "none",
      read_only: "view",
    },
    grants: {
      owner: "full",
      bookkeeper: "view",
      tax_professional: "view",
      grant_manager: "full",
      employee: "none",
      read_only: "view",
    },
    mileage: {
      owner: "full",
      bookkeeper: "edit",
      tax_professional: "view",
      grant_manager: "view",
      employee: "own",
      read_only: "view",
    },
    reports: {
      owner: "full",
      bookkeeper: "full",
      tax_professional: "full",
      grant_manager: "grant",
      employee: "none",
      read_only: "view",
    },
    admin: {
      owner: "full",
      bookkeeper: "none",
      tax_professional: "none",
      grant_manager: "none",
      employee: "none",
      read_only: "none",
    },
  },
};
