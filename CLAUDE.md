# TradeDesk — Full Website Build Prompt

---

## 1. Project Summary

Build a full-stack, multi-page web application called **TradeDesk** — an all-in-one AI-powered stock trading command center for traders of all experience levels (beginner to advanced). TradeDesk's defining, hero feature is a **voice-activated AI assistant** that traders can use hands-free while analyzing charts on a separate monitor. The platform combines real stock data, technical and fundamental analysis tools, a trade journal, watchlist, and portfolio tracker into a single sharp, professional interface.

The tone of the product is: **professional, sharp, educational, and uniquely designed** — not a clone of any existing platform. It should feel like a tool built specifically for serious traders who also want to learn and grow.

---

## 2. Tech Stack

- **Frontend:** Next.js (React) with Tailwind CSS
- **Backend / Auth / Database:** Supabase (email + password authentication, PostgreSQL database for user data, journal entries, watchlists, and portfolios)
- **Deployment:** Vercel
- **Payments:** Stripe (Monthly + Annual Pro tiers)
- **Email Collection:** Beehiiv (embedded signup form on landing page)
- **Stock Data:** Yahoo Finance (via `yahoo-finance2` npm package) + Finnhub free tier API (for real-time quotes, news, and fundamentals where Yahoo falls short)
- **AI:** Google Gemini API (`gemini-2.5-flash` free tier) for the AI assistant — via `@google/generative-ai` npm package
- **Voice Input:** Web Speech API (free, browser-native) for wake-word detection and speech-to-text
- **Voice Output:** Web Speech Synthesis API (free, browser-native) for the AI's female voice response
- **Charts:** Lightweight Charts by TradingView (free, open-source npm package)

**Rule:** Always use free tools and free API tiers. If a feature cannot be built for free, note the limitation and suggest the best free alternative.

**Rule:** Every time a change or improvement is made to the codebase, provide clear, numbered, step-by-step instructions for what the developer should do (e.g., which files to create/edit, which commands to run, what to paste where, what environment variables to add).

---

## 3. Design System

### Color Palette
- **Primary Background (Dark Mode):** `#0A0F1E` (deep navy, near black)
- **Secondary Background:** `#0F1729` (slightly lighter navy for cards/panels)
- **Accent / Primary:** `#2F80ED` (electric blue)
- **Accent Glow:** `#4FA3FF` (lighter electric blue for hover states and highlights)
- **Success / Bullish:** `#00C896` (green)
- **Danger / Bearish:** `#FF4D4D` (red)
- **Text Primary:** `#F0F4FF` (off-white)
- **Text Secondary:** `#8A99B3` (muted slate blue)
- **Border:** `#1E2D4A` (subtle navy border)
- **Light Mode:** Full light mode counterpart with white/light grey backgrounds, deep navy text, and same electric blue accents

### Theme Toggle
- Dark/Light mode toggle in the top-right corner of the sidebar
- Persisted in localStorage and Supabase user preferences

### Typography
- **Display / Headings:** `Syne` (Google Font) — geometric, sharp, futuristic. Used for page titles, large metrics, and hero text
- **Body / UI:** `DM Mono` (Google Font) — monospaced, data-forward, clean. Used for numbers, prices, data labels, and body text
- These two fonts together create a unique identity: bold display paired with technical precision

### Layout
- **Left sidebar navigation** — fixed, collapsible, approximately 240px wide when expanded, 64px when collapsed (icon only)
- **Main content area** — takes the remaining screen width
- **No top navigation bar** — everything lives in the sidebar
- The sidebar should feel premium: subtle background blur, electric blue active state indicator, icon + label for each nav item

### Aesthetic Direction
- Unique to TradeDesk — do not reference or copy Robinhood, Bloomberg, or TradingView
- Dark mode default. Deep navy backgrounds with electric blue accents. Subtle glowing highlights on active elements
- Data cards with very subtle inner glow borders (`box-shadow: inset 0 0 0 1px rgba(47,128,237,0.15)`)
- Micro-animations on load: staggered card reveals, number counters animating up on dashboard load
- Custom scrollbars styled in navy/blue
- No rounded "bubbly" UI — prefer sharp corners (border-radius: 4–6px max) for a professional, terminal-like feel
- Grain texture overlay on backgrounds at very low opacity (3–5%) for depth

---

## 4. Pages & Routing

| Route | Page |
|---|---|
| `/` | Landing Page (public) |
| `/login` | Login Page |
| `/signup` | Signup Page |
| `/dashboard` | Dashboard (protected) |
| `/assistant` | AI Voice Assistant (protected) |
| `/technical` | Technical Analysis (protected) |
| `/fundamental` | Fundamental Analysis (protected) |
| `/watchlist` | Watchlist (protected) |
| `/portfolio` | Portfolio Tracker (protected) |
| `/journal` | Trade Journal (protected) |
| `/settings` | Settings (protected) |
| `/pricing` | Pricing Page (public) |

All routes except `/`, `/login`, `/signup`, and `/pricing` are protected — redirect unauthenticated users to `/login`.

---

## 5. Landing Page (`/`)

The landing page is the marketing face of TradeDesk. It must be bold, professional, and conversion-focused.

### Sections (top to bottom):
1. **Navbar** — Logo (left), nav links (Features, Pricing), Login + "Get Started Free" CTA buttons (right)
2. **Hero Section** — Large headline: *"Your AI Trading Command Center."* Subheadline explaining the voice assistant and analysis tools. Two CTAs: "Get Started Free" and "See How It Works." Animated mockup or screenshot of the dashboard in the background
3. **Features Section** — 6 feature cards highlighting: Voice AI Assistant, Technical Analysis, Fundamental Analysis, Watchlist, Trade Journal, Portfolio Tracker
4. **How It Works** — 3-step visual: 1) Open TradeDesk on your second monitor, 2) Say "Hey buddy" to activate your AI assistant, 3) Get instant educational analysis
5. **Pricing Section** — Free vs Pro comparison table (see Section 10)
6. **Email Capture / Newsletter** — Beehiiv embedded signup form. Headline: *"Get weekly market insights from TradeDesk."*
7. **Footer** — Logo, links, copyright

---

## 6. Auth Pages (`/login`, `/signup`)

- Clean, centered card on a deep navy background with subtle grid pattern
- Email + password fields
- Supabase Auth for all authentication logic
- On signup: create a user profile row in Supabase `profiles` table
- Show error messages inline (e.g., "Invalid credentials", "Email already in use")
- Link between login ↔ signup pages
- After login: redirect to `/dashboard`

---

## 7. Sidebar Navigation

The sidebar is present on all protected pages. It contains:

**Top section (logo + nav links):**
- TradeDesk logo / wordmark
- Dashboard
- AI Assistant
- Technical Analysis
- Fundamental Analysis
- Watchlist
- Portfolio
- Trade Journal

**Bottom section:**
- Settings
- Dark/Light mode toggle
- User avatar + name + plan badge (Free / Pro)
- Logout button

Active page highlighted with electric blue left border indicator and subtle blue background tint.

---

## 8. Dashboard (`/dashboard`)

The dashboard is the first thing a logged-in user sees. It is a market overview page.

### Sections:
1. **Top bar** — Greeting ("Good morning, [Name]"), current date/time, market status (Open / Closed)
2. **Market Indices Row** — Cards for S&P 500, NASDAQ, DOW, VIX. Each shows: current value, % change, sparkline mini-chart. Color-coded green/red. Data from Finnhub or Yahoo Finance
3. **Top Movers** — Two columns: Top Gainers and Top Losers (5 each). Each row: ticker, company name, price, % change. Data from Finnhub
4. **Sector Heat Map** — A grid of 11 S&P 500 sectors color-coded by performance (green = up, red = down, intensity = magnitude). Data from Finnhub or Yahoo Finance
5. **Quick Watchlist Snapshot** — A small preview of the user's watchlist (first 5 stocks) with price and % change
6. **AI Daily Brief Widget** — A card that says "Ask your AI assistant for today's market brief" with a mic button that activates the voice assistant

All data cards animate in with staggered fade-up on page load. Numbers count up from 0 to their value on load.

---

## 9. AI Voice Assistant (`/assistant`)

This is the hero feature of TradeDesk. It must be built with extreme care.

### How it works:
- The page is always-listening (with user permission) for the wake phrase **"Hey buddy"**
- Use the **Web Speech API** (`SpeechRecognition`) for continuous listening and speech-to-text
- When "Hey buddy" is detected, the UI activates (glowing mic animation, visual indicator "Listening...")
- The user speaks their question (e.g., "Hey buddy, what does a bearish MACD crossover mean and should I be worried if I'm long on NVDA?")
- The full spoken query is transcribed and sent to the **Gemini API** (`gemini-2.5-flash`)
- The AI responds in an **educational tone** — always explaining the WHY behind every signal, concept, or suggestion. It never just says "buy" or "sell" — it teaches
- The response is both:
  - **Displayed as text** in a chat-style conversation panel on screen
  - **Spoken aloud** using the **Web Speech Synthesis API** with a **female voice** (select the best available female voice from `speechSynthesis.getVoices()`)
- The conversation history is maintained for the session so follow-up questions work contextually
- Users can also type questions if they prefer

### UI Layout:
- Left panel: Conversation history (chat bubbles — user on right, AI on left with a subtle blue glow)
- Right panel: A live "AI Status" indicator (Idle / Listening / Thinking / Speaking) with an animated waveform when speaking
- Bottom: Text input + send button as fallback
- Top: Toggle to enable/disable always-listening mode

### Claude System Prompt (send this with every API call):
```
You are TradeDesk's AI trading assistant — a knowledgeable, educational, and professional financial coach. Your job is to help traders of all levels understand the stock market, technical analysis, fundamental analysis, and trading concepts.

IMPORTANT RULES:
- Always explain the WHY behind every signal, indicator, or concept you mention
- Never give direct buy or sell recommendations — instead, explain what the data suggests and let the user make their own decision
- Be conversational but precise — you're talking to someone who may be actively trading
- Keep responses concise enough to be spoken aloud (aim for under 120 words unless the user asks for more detail)
- When referencing specific stocks, always remind the user this is educational analysis, not financial advice
- Use clear, plain language for beginners but don't dumb it down for advanced users — read the context of the question
```

### Freemium Gate:
- Free users: 10 AI queries per day (tracked in Supabase)
- Pro users: unlimited queries
- When the free limit is hit, show a friendly upgrade prompt

---

## 10. Technical Analysis (`/technical`)

### Stock Search:
- Search bar at the top — user types a ticker symbol (e.g., AAPL, TSLA)
- Pulls data from Yahoo Finance (`yahoo-finance2`) and Finnhub

### Chart:
- Full interactive chart using **Lightweight Charts by TradingView** (free npm package)
- Candlestick chart by default
- Timeframe selector: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y

### Indicator Toggles (overlay on chart):
Each indicator has an ON/OFF toggle button above the chart:
- Simple Moving Average (SMA 20, SMA 50, SMA 200)
- Exponential Moving Average (EMA 12, EMA 26)
- Bollinger Bands
- VWAP (intraday only)
- Fibonacci Retracement (auto-drawn based on visible price range)
- Volume bars (below chart)

### Separate Analysis Buttons (each runs a calculation and displays results in a modal or side panel):
- **MACD** — Show MACD line, signal line, histogram. Explain what the current reading means educationally
- **RSI** — Show RSI value and chart. Explain overbought/oversold context
- **Volume Profile** — Show volume by price level
- **Mean Reversion Signal** — Calculate and display whether stock is statistically stretched above/below its mean
- **Z-Score / Statistical Deviation** — Show current Z-score and what it implies
- **Linear Regression Trend** — Fit and display a regression line with predicted price
- **Momentum Score** — Combine 3M, 6M, 12M returns into a single score
- **Relative Strength vs. S&P 500** — Compare stock performance to SPX over the same period
- **Monte Carlo Simulation** — Run 1,000 simulations of future price paths based on historical volatility. Display as a probability cone chart with a summary (e.g., "70% chance price is between $X and $Y in 90 days"). This button is clearly labeled and separate from the indicator toggles
- **Sharpe Ratio Estimate** — Calculate and display with explanation
- **Support & Resistance Auto-Detection** — Identify and draw key levels on the chart

### AI Analysis Button:
- A prominent **"Run AI Analysis"** button on this page
- When clicked, gathers the current chart data and active indicators and sends to Gemini API
- Claude returns an educational summary of what the technicals are showing
- Displayed in a panel below the chart, also read aloud by the voice assistant

---

## 11. Fundamental Analysis (`/fundamental`)

### Stock Search:
- Same search bar as Technical Analysis — search by ticker

### Auto-Displayed Metrics (shown immediately on stock load, no button needed):
These are simple metrics fetched from Yahoo Finance / Finnhub:
- **P/E Ratio** — with tooltip explanation
- **EPS (TTM)** — with tooltip explanation
- **ROE** — with tooltip explanation
- **Beta** — with tooltip explanation
- **Dividend Yield** — with tooltip explanation
- **Market Cap**
- **52-Week High / Low**
- **Revenue (TTM)**
- **Profit Margin**
- **Analyst Rating** (Buy / Hold / Sell consensus from Finnhub)

Each metric has a small **info icon (ⓘ)** that shows a plain-English tooltip explaining what it means when hovered.

### Calculated Metric Buttons (each has its own button, runs on demand):
- **Fair Value Estimate** — Calculate using a simplified DCF or earnings-based model. Show result vs current price with "Undervalued / Fairly Valued / Overvalued" label
- **Momentum Score** — 3M + 6M + 12M return combined score
- **Mean Reversion Signal** — Price vs historical mean, flagging if stretched

### News Feed:
- Below the metrics, show the latest 10 news headlines for the stock (from Finnhub free news API)
- Each headline is clickable and opens the article in a new tab
- Headlines show: source, title, time ago

### AI Fundamental Summary Button:
- **"Get AI Fundamental Analysis"** button
- Sends all displayed metrics to Gemini API
- Claude returns an educational summary of the company's financial health, what the numbers suggest, and what a trader should think about — never a direct recommendation
- Read aloud by the voice assistant

---

## 12. Watchlist (`/watchlist`)

- User can add stocks by ticker symbol
- Stored in Supabase per user
- Free users: up to 10 stocks
- Pro users: unlimited stocks
- Each row displays: Ticker, Company Name, Price, % Change (today), Volume, Market Cap
- Color-coded % change (green/red)
- Click a stock → goes to Technical Analysis page pre-loaded with that ticker
- Remove button (×) on each row
- Data refreshes every 60 seconds automatically

---

## 13. Portfolio Tracker (`/portfolio`)

- User manually inputs their holdings: Ticker, Number of Shares, Average Buy Price
- Stored in Supabase
- System calculates and displays:
  - Current Price (live from Yahoo/Finnhub)
  - Current Value
  - Total Cost Basis
  - Unrealized P&L ($ and %)
  - Total Portfolio Value
  - Total Portfolio P&L
- Color-coded green/red for gains/losses
- Simple pie chart showing portfolio allocation by stock (use Recharts — free)
- Data refreshes every 60 seconds

---

## 14. Trade Journal (`/journal`)

- User logs completed trades
- **Fields per entry:**
  - Date
  - Ticker
  - Entry Price
  - Exit Price
  - Number of Shares
  - P&L (auto-calculated)
  - Notes (free text)
- All entries stored in Supabase
- Table view of all past trades, sortable by date / ticker / P&L
- **Summary stats at top:**
  - Total trades logged
  - Win rate (%)
  - Total realized P&L
  - Average P&L per trade
- Edit and delete entries

---

## 15. Pricing Page (`/pricing`)

Two tiers displayed as side-by-side cards:

### Free Tier — $0/month
- Full platform access
- 10 AI assistant queries per day
- Watchlist: up to 10 stocks
- All technical and fundamental tools
- Trade journal and portfolio tracker
- Voice assistant (within daily AI limit)

### Pro Tier — $19/month or $149/year (save ~35%)
- Everything in Free
- **Unlimited** AI assistant queries
- **Unlimited** watchlist stocks
- Priority response speed
- Early access to new features

Stripe Checkout integration:
- "Upgrade to Pro" button triggers Stripe Checkout session
- On success: update `profiles` table in Supabase with `plan: 'pro'`
- On cancel: return to pricing page
- Manage subscription via Stripe Customer Portal

---

## 16. Settings (`/settings`)

- Update display name
- Change password (via Supabase)
- Theme preference (Dark / Light) — saved to Supabase
- Voice assistant toggle (enable/disable always-listening)
- Manage subscription (link to Stripe Customer Portal)
- Delete account

---

## 17. Supabase Database Schema

### `profiles` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | References auth.users |
| full_name | text | |
| email | text | |
| plan | text | 'free' or 'pro' |
| ai_queries_today | integer | Resets daily |
| ai_queries_reset_date | date | |
| theme | text | 'dark' or 'light' |
| created_at | timestamp | |

### `watchlist` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | References profiles |
| ticker | text | |
| added_at | timestamp | |

### `portfolio` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| ticker | text | |
| shares | numeric | |
| avg_buy_price | numeric | |

### `journal` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| date | date | |
| ticker | text | |
| entry_price | numeric | |
| exit_price | numeric | |
| shares | numeric | |
| pnl | numeric | Auto-calculated |
| notes | text | |
| created_at | timestamp | |

---

## 18. Environment Variables

The following must be added to `.env.local` and Vercel environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
FINNHUB_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
NEXT_PUBLIC_BEEHIIV_FORM_URL=
```

---

## 19. Step-by-Step Instruction Rule

**Every time a change, fix, or new feature is added to the codebase, the response must include:**

1. Which file(s) to create or edit (with full file path)
2. Exactly what to add, change, or remove (with full code blocks)
3. Any new npm packages to install (with exact `npm install` command)
4. Any new environment variables to add
5. Any Supabase table changes or SQL to run
6. How to test that the change worked
7. The `git` commands to commit and push (so Vercel auto-deploys)

Never assume the developer knows what to do next. Always be explicit and complete.

---

## 20. General Rules for Claude When Building This

- Always write clean, production-quality Next.js code with proper TypeScript types where possible
- Use Tailwind CSS for all styling — no inline styles except for dynamic values
- All API calls to Yahoo Finance and Finnhub must be made from **Next.js API routes** (server-side), never directly from the client, to protect API keys
- The Gemini API must only be called from a Next.js API route — never expose the API key to the client
- Voice features use browser-native Web Speech API — no external service needed
- Always handle loading states (skeletons), error states, and empty states for every data-fetching component
- Mobile responsiveness is required — the sidebar collapses to a bottom tab bar on mobile
- Use Supabase Row Level Security (RLS) policies so users can only access their own data
- Free tier AI query limit is enforced server-side in the API route, not just client-side
