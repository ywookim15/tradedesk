# TradeDesk 📈

An AI-powered stock trading command center for traders of all experience levels. TradeDesk combines real-time stock data, technical and fundamental analysis, a voice-activated AI assistant, trade journal, watchlist, and portfolio tracker into a single professional interface.

---

## Features

- **Voice-Activated AI Assistant** — Hands-free AI powered by Google Gemini. Use a wake word to ask questions while keeping your eyes on the charts.
- **Real-Time Stock Data** — Live quotes, charts, and news via Yahoo Finance and Finnhub.
- **Interactive Charts** — Candlestick and line charts via TradingView's Lightweight Charts library.
- **Trade Journal** — Log and review your trades with notes and performance history.
- **Watchlist** — Track your favorite tickers in one place.
- **Portfolio Tracker** — Monitor positions, P&L, and overall portfolio health.
- **Authentication** — Secure email/password login via Supabase.
- **Pro Subscription** — Monthly and annual plans via Stripe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + Tailwind CSS v4 |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Deployment | Vercel |
| Payments | Stripe |
| Email Collection | Beehiiv |
| Stock Data | `yahoo-finance2` + Finnhub API |
| AI | Google Gemini (`gemini-2.5-flash`) via `@google/generative-ai` |
| Voice Input | Web Speech API (browser-native) |
| Voice Output | Web Speech Synthesis API (browser-native) |
| Charts | Lightweight Charts by TradingView |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- A Google Gemini API key (free tier)
- A Finnhub API key (free tier)
- A Stripe account (for payments)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/tradedesk-app.git
cd tradedesk-app
```

2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file and fill in your keys:

```bash
cp .env.example .env.local
```

4. Add the following environment variables to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Finnhub
FINNHUB_API_KEY=your_finnhub_api_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
tradedesk-app/
├── app/                  # Next.js App Router pages and layouts
├── components/           # Reusable React components
├── lib/                  # Utility functions, Supabase client, API helpers
├── public/               # Static assets
├── styles/               # Global styles
└── .env.local            # Environment variables (not committed)
```

---

## Deployment

TradeDesk is designed to deploy on [Vercel](https://vercel.com).

1. Push your code to GitHub.
2. Import the repository in the Vercel dashboard.
3. Add all environment variables from `.env.local` to your Vercel project settings.
4. Deploy.

---

## Free Tier Notes

This project is built entirely on free tiers:

- **Gemini API** — Free tier via Google AI Studio (`gemini-2.5-flash`)
- **Finnhub** — Free tier (60 calls/minute)
- **Supabase** — Free tier (500MB database, 50MB file storage)
- **Vercel** — Free Hobby plan
- **Web Speech API** — Browser-native, no cost

If you exceed free tier limits on any service, consult that provider's paid plans.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.
