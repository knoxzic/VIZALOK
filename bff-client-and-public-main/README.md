# Best Face Forward — Enterprise Site

High-profile multi-division website for **Best Face Forward Consultants, LLC**.  
Welcome gate → landing (signature portal carousel) → six division portals + Expense IQ.  
**Supabase auth** helpers are wired for client/team sign-in.

## Supabase

Required public env (also supported as `BFF.config.supabase` in `js/config.js`):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

| File | Role |
|------|------|
| [`lib/supabase.js`](lib/supabase.js) | ESM client for bundlers / Next.js |
| [`js/supabase/config.js`](js/supabase/config.js) | Reads env + normalizes dashboard URLs |
| [`js/supabase/client.js`](js/supabase/client.js) | Browser client factory |
| [`js/supabase/auth.js`](js/supabase/auth.js) | signIn / signUp / signOut / getSession |
| [`pages/auth.html`](pages/auth.html) | Sign-in UI |

Copy [`.env.example`](.env.example) → `.env` (gitignored). Never commit the service role key.

## Integrated practice platforms

| Product | Docs |
|---------|------|
| Expense IQ™ | [`expense-iq/docs/`](expense-iq/docs/) |
| BFF Financial Solutions™ | [`docs/financial-solutions/`](docs/financial-solutions/) |
| BFF Insurance Solutions™ | [`docs/insurance-solutions/`](docs/insurance-solutions/) |

## Open the site (offline)

Double-click or serve the folder:

```
index.html          → Welcome gate (invitation + video frame + Enter Site)
landing.html        → Pink gloss nav + hero + 5 division tiles
```

Or from this folder:

```powershell
# optional local server
npx --yes serve .
```

Then open the URL shown (usually `http://localhost:3000`).

## Flow

```
Welcome (index.html)
    ↓ Enter Site
Landing (landing.html)
    ├── About / Culture / Contact  (pages/)
    ├── Foundation · Financial · Insurance · Logistics  (portals/ — polished placeholders)
    └── G&G Software Solutions
            ├── Software portal  → buy products (demo unlock / Stripe links)
            └── Academy portal   → enroll → quizzes → graduate unlocks
```

## Design system

| Token        | Value     | Role                |
|-------------|-----------|---------------------|
| Emerald     | `#0B4D3A` | Primary / authority |
| Dusty rose  | `#E7A8BE` | Gloss nav / warmth  |
| Muted gold  | `#C6A15B` | Hairlines / accents |
| Blush ivory | `#FBF1EE` | Backgrounds         |
| Charcoal    | `#2A2620` | Body text           |

**Type:** Cinzel (display) · Cormorant Garamond (body) · Pinyon Script (taglines)

## Folder map

```
New BFF/
├── index.html              Welcome / gate
├── landing.html            Main landing
├── success.html            Post-purchase confirmation (demo + Stripe return)
├── expense-iq/             Expense IQ™ product app (Phase 1 foundation — own domain later)
├── assets/                 logo, video, owner photo, brand sheets
├── css/                    tokens, main, welcome, landing, portals, academy
├── js/
│   ├── config.js           Products, Stripe URLs, GIGI_ENDPOINT, DEMO_MODE
│   ├── storage.js          localStorage unlocks (webhook-shaped events)
│   ├── main.js             Nav, toast, checkout modal
│   ├── gigi.js             Floating concierge (demo FAQ → live endpoint)
│   ├── software.js         Product grid
│   └── academy.js          Enrollment + quiz engine
├── pages/                  about, culture, contact
├── portals/                foundation, financial, insurance, logistics, software, academy
├── portal.html             Legacy client login scaffold (Firebase)
└── index.js                Backend example (Gigi + Stripe webhook) — deploy separately
```

## Expense IQ™

Product app under [`expense-iq/`](expense-iq/README.md). Linked from Software and Financial portals.  
Open: `expense-iq/index.html` or `npx serve expense-iq`. Local multi-tenant scaffold (no paid APIs yet); ready to split to its own GitHub repo and domain.

## Demo purchase & Academy

1. Open **Software** or **Academy**.
2. Click purchase / enroll → **Simulate successful payment** (DEMO_MODE is `true` in `js/config.js`).
3. You land on `success.html`; access is stored in `localStorage` under keys like `bff_unlock_*`.
4. Academy: enroll → complete 3 quiz modules → graduate unlocks highlight.

Real Stripe Payment Links for several products are already in `config.js`. Set:

```js
DEMO_MODE: false
```

…to prefer live Checkout when a `stripeUrl` exists. You can still open Stripe from the modal’s secondary action while in demo mode.

## Gigi (structure ready)

- Floating button on all main pages (off on welcome gate).
- Demo: local FAQ matching.
- Live: set `BFF.config.GIGI_ENDPOINT` to your Cloud Function (see `index.js` example). **Never put AI API keys in the browser.**

## Stripe webhooks (later)

Static hosting cannot receive webhooks. Deploy `stripeWebhook` from `index.js` (or equivalent), then:

1. Point Stripe webhooks at that URL.
2. On `checkout.session.completed`, write unlock flags / send Academy admin email.
3. Keep `success.html` as the customer return page; optionally verify `session_id` via your API.

Unlock keys in `config.js` should stay stable so webhooks and the front-end stay aligned.

## Assets

| File | Use |
|------|-----|
| `assets/logo.png` | Emblem |
| `assets/welcome-bg.mp4` | Invitation video (MP4 preferred) |
| `assets/logo-video.mov` | Fallback source |
| `assets/owner.png` | Leadership portrait |
| `assets/divisions.jpeg` | Brand sheet reference |
| `assets/gg-software.jpeg` | G&G mark reference |

If video fails to load offline, the invitation frame shows an elegant script fallback.

## Legacy

- `portal.html` — earlier Firebase client portal (kept for backend work).
- Old public marketing page was replaced by this multi-page experience; Stripe product links preserved in `config.js`.
