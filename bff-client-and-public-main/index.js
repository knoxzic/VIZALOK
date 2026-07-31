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
// 2. STRIPE WEBHOOK — Stripe calls THIS after a checkout completes.
//    A static site can never receive webhooks directly; it needs a server URL like this.
// ---------------------------------------------------------------
const stripe = require("stripe")(functions.config().stripe.secret_key);

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Mark the matching client record as paid, e.g.:
      await admin.firestore().collection("orders").add({
        stripeSessionId: session.id,
        customerEmail: session.customer_details?.email || null,
        amountTotal: session.amount_total,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      break;
    }
    default:
      // Ignore other event types for now.
      break;
  }

  res.json({ received: true });
});
