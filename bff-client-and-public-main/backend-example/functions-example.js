/**
 * EXAMPLE ONLY — deploy this separately (e.g. as Firebase Cloud Functions).
 * This is what the static website talks to instead of ever holding an API key itself.
 *
 * Setup:
 *   firebase init functions
 *   firebase functions:config:set gigi.api_key="YOUR_AI_PROVIDER_KEY" stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
 *   firebase deploy --only functions
 *
 * Then in index.html / portal.html, set:
 *   const GIGI_ENDPOINT = "https://REGION-PROJECT.cloudfunctions.net/gigiChat";
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// ---------------------------------------------------------------
// 1. GIGI CHAT — the site calls this; this function holds the real key.
// ---------------------------------------------------------------
exports.gigiChat = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*"); // tighten to your real domain before going live
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const userMessage = (req.body && req.body.message) || "";
  if (!userMessage) {
    return res.status(400).json({ error: "Missing 'message' in request body." });
  }

  const apiKey = functions.config().gigi.api_key; // never exposed to the browser
  const systemPrompt = `You are Gigi, the AI Due Diligence Concierge for Best Face Forward Consultants.
You help with business formation, bookkeeping, tax prep, IRS resolution, grant research and writing,
nonprofit compliance, financial strategy, funding readiness, and business systems.
Ask clarifying questions before recommending a specific service. Be warm, organized, and concise.`;

  try {
    // Example using an OpenAI-compatible chat completions endpoint.
    // Swap the URL/body shape for whichever provider you're actually using.
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
    res.json({ reply });
  } catch (err) {
    console.error("Gigi chat error:", err);
    res.status(500).json({ reply: "Gigi is temporarily unavailable. Please try again shortly." });
  }
});

// ---------------------------------------------------------------
// 2. STRIPE WEBHOOK → Supabase subscriptions
//    Prefer: supabase/functions/stripe-webhook (Edge Function)
//    Or: backend-example/stripe-webhook-supabase.js
//    This Firebase stub forwards to the same handleStripeEvent logic.
//
//    firebase functions:config:set \
//      stripe.secret_key="sk_..." \
//      stripe.webhook_secret="whsec_..." \
//      supabase.url="https://xxx.supabase.co" \
//      supabase.service_role="eyJ..."
// ---------------------------------------------------------------
const stripe = require("stripe")(functions.config().stripe.secret_key);

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  // Wire env for shared handler
  process.env.STRIPE_SECRET_KEY = functions.config().stripe.secret_key;
  process.env.STRIPE_WEBHOOK_SECRET = functions.config().stripe.webhook_secret;
  process.env.SUPABASE_URL = functions.config().supabase.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = functions.config().supabase.service_role;

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      functions.config().stripe.webhook_secret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Dynamic import of shared handler (copy stripe-webhook-supabase into functions bundle)
    const { handleStripeEvent } = require("./stripe-webhook-supabase");
    const result = await handleStripeEvent(event);
    // Optional mirror to Firestore for admin dashboards
    await admin.firestore().collection("stripe_events").doc(event.id).set({
      type: event.type,
      result,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ received: true, ...result });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: err.message || "handler failed" });
  }
});
