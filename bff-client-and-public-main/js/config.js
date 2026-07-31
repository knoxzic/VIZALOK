/**
 * Best Face Forward — site config
 * Swap Stripe URLs and GIGI_ENDPOINT when backend goes live.
 * Structure is ready for webhooks without major refactoring.
 */
window.BFF = window.BFF || {};

BFF.config = {
  brand: {
    name: "Best Face Forward Consultants",
    short: "BFF",
    tagline: "Moving You Forward.",
    motto: "Strategy. Solutions. Impact.",
  },

  /**
   * Set to your Cloud Function URL when ready, e.g.:
   * "https://us-central1-bestfaceforward-a5f69.cloudfunctions.net/gigiChat"
   * null = smart demo replies (no API key in the browser)
   */
  GIGI_ENDPOINT: null,

  /**
   * Demo mode: simulate purchases/enrollment via localStorage unlocks.
   * When false and stripe links exist, real checkout opens.
   */
  DEMO_MODE: true,

  /**
   * Supabase (public anon key is safe in the browser).
   * Override with NEXT_PUBLIC_SUPABASE_* env or window.__ENV on deploy.
   * Project ref: rjxiytnoomgpodkpvxad
   */
  supabase: {
    url: "https://rjxiytnoomgpodkpvxad.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqeGl5dG5vb21ncG9ka3B2eGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTM4MDIsImV4cCI6MjEwMTA4OTgwMn0.TGW9RWrru2cqMyr19QGA_biryvNuaW4CGNJOaF7ACHk",
    enabled: true,
  },

  /**
   * After real Stripe Checkout, success_url can hit success.html?product=ID
   * Webhooks (server-side) will later write the same unlock keys to Firestore.
   */
  successPath: "success.html",

  products: {
    diy_starter: {
      id: "diy_starter",
      name: "D.I.Y Starter Kit",
      price: 197,
      description: "Templates, checklists, and guided systems to stand up your books and ops with confidence.",
      benefits: ["Foundation workbook", "Document checklist", "Self-paced setup guide"],
      stripeUrl: "https://buy.stripe.com/3cI8wQ5RXgokdR2a1B1sQ0e",
      unlockKey: "bff_unlock_diy_starter",
      portal: "software",
    },
    funding_readiness: {
      id: "funding_readiness",
      name: "Funding Readiness Assessment",
      price: 497,
      description: "A polished readiness review so you know exactly where funders will scrutinize you.",
      benefits: ["Scorecard report", "Gap analysis", "Priority action plan"],
      stripeUrl: "https://buy.stripe.com/7sY9AUbchb40bIUflV1sQ0f",
      unlockKey: "bff_unlock_funding_readiness",
      portal: "software",
    },
    childcare_accelerator: {
      id: "childcare_accelerator",
      name: "Child Care Funding Accelerator",
      price: 2997,
      description: "Our flagship path for child-care operators ready to pursue serious funding.",
      benefits: ["Done-with-you strategy", "Packet polish", "Priority support"],
      stripeUrl: "https://buy.stripe.com/3cI00kcgl9ZWfZa6Pp1sQ0g",
      unlockKey: "bff_unlock_childcare_accelerator",
      portal: "software",
      popular: true,
    },
    grant_writing: {
      id: "grant_writing",
      name: "Grant Writing Services",
      price: 1500,
      priceLabel: "$1,500+",
      description: "Professional narrative, budgets, and attachments crafted for your mission.",
      benefits: ["Custom narrative", "Budget alignment", "Submission-ready package"],
      stripeUrl: "https://buy.stripe.com/14A14oeot8VSbIU8Xx1sQ0h",
      unlockKey: "bff_unlock_grant_writing",
      portal: "software",
    },
    first_two_grants: {
      id: "first_two_grants",
      name: "First 2 Grants — Done For You",
      price: 750,
      description: "We research and package your first two grant submissions end to end.",
      benefits: ["Two full applications", "Research included", "Revision round"],
      stripeUrl: "https://buy.stripe.com/14A8wQ3JPfkgbIUgpZ1sQ0i",
      unlockKey: "bff_unlock_first_two_grants",
      portal: "software",
    },
    academy_enroll: {
      id: "academy_enroll",
      name: "Business Academy Enrollment",
      price: 497,
      description: "Game-based curriculum with elegant business styling — enroll once, learn for life (demo).",
      benefits: [
        "Interactive modules & Kahoot-style quizzes",
        "Progress tracking",
        "Standalone product unlocks after completion",
      ],
      // Replace with real Stripe Payment Link when ready
      stripeUrl: "",
      unlockKey: "bff_unlock_academy",
      portal: "academy",
    },
    academy_playbook: {
      id: "academy_playbook",
      name: "Academy Graduate Playbook",
      price: 0,
      description: "Standalone ops playbook unlocked after Academy enrollment (demo).",
      benefits: ["Systems map", "90-day calendar", "Template vault"],
      stripeUrl: "",
      unlockKey: "bff_unlock_academy_playbook",
      requires: "bff_unlock_academy",
      portal: "academy",
    },
  },

  divisions: [
    {
      id: "foundation",
      name: "Best Face Forward",
      sub: "Foundation",
      tagline: "Building Strong Organizations.",
      href: "portals/foundation.html",
      icon: "🌿",
      foot: "Grant writing · Board development · Capacity building",
    },
    {
      id: "financial",
      name: "Best Face Forward",
      sub: "Financial Solutions",
      tagline: "Financial Confidence.",
      href: "portals/financial.html",
      icon: "📈",
      foot: "Bookkeeping · Cash flow · Strategic planning",
    },
    {
      id: "insurance",
      name: "Best Face Forward",
      sub: "Insurance Solutions",
      tagline: "Protecting Today.",
      href: "portals/insurance.html",
      icon: "🛡️",
      foot: "Life · Health · Retirement · Benefits",
    },
    {
      id: "logistics",
      name: "Best Face Forward",
      sub: "Logistics Consulting",
      tagline: "Moving Businesses Forward.",
      href: "portals/logistics.html",
      icon: "🧭",
      foot: "Supply chain · Route optimization · Ops efficiency",
    },
    {
      id: "software",
      name: "G&G",
      sub: "Software Solutions",
      tagline: "Infinite Possibilities.",
      href: "portals/software.html",
      icon: "◇",
      foot: "Custom software · AI integration · Workflow design",
      highlight: true,
    },
    {
      id: "expense_iq",
      name: "Expense IQ",
      sub: "Financial Platform",
      tagline: "Every dollar, one ledger.",
      href: "expense-iq/index.html",
      icon: "assets/icon-expense-iq.svg",
      foot: "Capture · Ledger · Grants · Tax-ready",
      cta: "Enter portal",
      description:
        "Smart expense tracking, AI-powered reporting, receipt management, budgeting, and real-time financial visibility for organizations.",
    },
  ],
};
