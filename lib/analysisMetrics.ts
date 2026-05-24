// ═══════════════════════════════════════════════════════════════════════════
// analysisMetrics.ts — Metric definitions for the Stock Analysis AI engine
//
// ADD NEW METRICS HERE — add an entry to METRIC_DEFS below.
// Each entry is automatically picked up by:
//   • /api/ai/stock-analysis  (computes values, signals, explanations)
//   • StockAnalysisClient     (renders the Detailed Overview table)
//
// To add a new metric:
//   1. Add a MetricDef entry in METRIC_DEFS
//   2. Compute its value in the API route's metricValues object
//   3. Done — the rest of the system picks it up automatically
// ═══════════════════════════════════════════════════════════════════════════

export type Signal = 'bullish' | 'neutral' | 'bearish'

// Context values available to getSignal / explain (string or number, keyed by name)
export type MetricContext = Record<string, string | number | null>

export type MetricDef = {
  key: string
  label: string
  category: 'fundamental' | 'technical' | 'regime'
  tooltip: string
  // value is null for non-numeric metrics (use ctx instead)
  getSignal: (value: number | null, ctx?: MetricContext) => Signal
  explain: (value: number | null, ctx?: MetricContext) => string
}

export const METRIC_DEFS: MetricDef[] = [

  // ── Fundamental Metrics ───────────────────────────────────────────────────

  {
    key: 'pe',
    label: 'P/E Ratio (TTM)',
    category: 'fundamental',
    tooltip: 'How much investors pay per $1 of earnings. Lower can mean cheaper, but growth stocks naturally command higher multiples.',
    getSignal: (v) => v == null ? 'neutral' : v <= 0 ? 'bearish' : v < 15 ? 'bullish' : v > 35 ? 'bearish' : 'neutral',
    explain: (v) => {
      if (v == null) return 'P/E data not available.'
      if (v <= 0) return 'Negative P/E — the company is currently unprofitable on a trailing basis.'
      if (v < 15) return `P/E of ${v.toFixed(1)}x is below the historical S&P 500 average of ~17x — suggesting value pricing or modest growth expectations.`
      if (v > 35) return `P/E of ${v.toFixed(1)}x is elevated — significant future growth is priced in. Any disappointment can trigger a sharp re-rating.`
      return `P/E of ${v.toFixed(1)}x is near the historical market average — reasonably priced relative to current earnings.`
    },
  },

  {
    key: 'forwardPE',
    label: 'Forward P/E',
    category: 'fundamental',
    tooltip: "Uses next year's estimated earnings. A lower forward P/E than trailing suggests analysts expect earnings growth ahead.",
    getSignal: (v, ctx) => {
      if (v == null) return 'neutral'
      const trailing = typeof ctx?.pe === 'number' ? ctx.pe : null
      if (trailing && trailing > 0 && v < trailing * 0.85) return 'bullish'
      if (v > 35) return 'bearish'
      return 'neutral'
    },
    explain: (v, ctx) => {
      if (v == null) return 'Forward P/E not available.'
      const trailing = typeof ctx?.pe === 'number' && ctx.pe > 0 ? ctx.pe : null
      if (trailing && v < trailing * 0.85) {
        return `Forward P/E of ${v.toFixed(1)}x is meaningfully below trailing P/E of ${trailing.toFixed(1)}x — implying strong expected earnings growth.`
      }
      return `Forward P/E of ${v.toFixed(1)}x. ${v > 35 ? 'Elevated valuation based on forward estimates.' : 'In-line with reasonable growth expectations.'}`
    },
  },

  {
    key: 'eps',
    label: 'EPS (TTM)',
    category: 'fundamental',
    tooltip: 'Earnings Per Share: net profit divided by shares outstanding. Positive EPS means profitable; the foundation of most valuation models.',
    getSignal: (v) => v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish',
    explain: (v) => {
      if (v == null) return 'EPS data not available.'
      return v > 0
        ? `EPS of $${v.toFixed(2)} — the company is profitable. This positive baseline supports standard valuation models.`
        : `EPS of $${v.toFixed(2)} — the company is unprofitable on a trailing twelve-month basis. Risk is elevated until a path to profitability is clear.`
    },
  },

  {
    key: 'profitMargin',
    label: 'Profit Margin',
    category: 'fundamental',
    tooltip: 'Net profit as a percentage of revenue. Higher margins mean more of each dollar in sales becomes profit.',
    getSignal: (v) => v == null ? 'neutral' : v > 0.2 ? 'bullish' : v > 0 ? 'neutral' : 'bearish',
    explain: (v) => {
      if (v == null) return 'Profit margin data not available.'
      const pct = (v * 100).toFixed(1)
      if (v > 0.25) return `${pct}% net margin is exceptional — the business retains a large share of revenue as profit.`
      if (v > 0.1) return `${pct}% net margin is healthy and above average for most sectors.`
      if (v > 0) return `${pct}% net margin is thin — profitable but operating on narrow margins.`
      return `${pct}% net margin is negative — expenses exceed revenue.`
    },
  },

  {
    key: 'roe',
    label: 'Return on Equity',
    category: 'fundamental',
    tooltip: 'How much profit generated per dollar of shareholder equity. Above 15% is generally considered strong capital efficiency.',
    getSignal: (v) => v == null ? 'neutral' : v > 0.15 ? 'bullish' : v > 0 ? 'neutral' : 'bearish',
    explain: (v) => {
      if (v == null) return 'ROE data not available.'
      const pct = (v * 100).toFixed(1)
      if (v > 0.25) return `ROE of ${pct}% is excellent — the company generates strong returns on shareholder capital.`
      if (v > 0.15) return `ROE of ${pct}% exceeds the 15% benchmark, indicating efficient use of equity.`
      if (v > 0) return `ROE of ${pct}% is positive but below the 15% benchmark — room for improvement.`
      return `ROE of ${pct}% is negative — the company is not generating returns on equity.`
    },
  },

  {
    key: 'debtToEquity',
    label: 'Debt / Equity',
    category: 'fundamental',
    tooltip: 'Debt relative to shareholder equity. High D/E amplifies both returns and risk; low D/E signals conservative financing.',
    getSignal: (v) => v == null ? 'neutral' : v < 0.5 ? 'bullish' : v > 2 ? 'bearish' : 'neutral',
    explain: (v) => {
      if (v == null) return 'Debt-to-equity data not available.'
      if (v < 0.5) return `D/E of ${v.toFixed(2)}x is low — the company is conservatively financed with minimal debt.`
      if (v > 2) return `D/E of ${v.toFixed(2)}x is elevated — high leverage amplifies both upside and downside risk.`
      return `D/E of ${v.toFixed(2)}x is moderate — balanced use of debt and equity financing.`
    },
  },

  {
    key: 'beta',
    label: 'Beta',
    category: 'fundamental',
    tooltip: 'Volatility relative to the S&P 500. Beta > 1 = moves more than the market; Beta < 1 = less volatile; Beta < 0 = inversely correlated.',
    getSignal: () => 'neutral',
    explain: (v) => {
      if (v == null) return 'Beta data not available.'
      if (v > 1.5) return `Beta of ${v.toFixed(2)} — high volatility stock, amplifies market moves by ~${v.toFixed(1)}x in both directions.`
      if (v < 0) return `Beta of ${v.toFixed(2)} — inversely correlated with the market, often acts as a hedge.`
      if (v < 0.5) return `Beta of ${v.toFixed(2)} — defensive stock with significantly less volatility than the broad market.`
      return `Beta of ${v.toFixed(2)} — roughly inline with the market's typical movement.`
    },
  },

  {
    key: 'dividendYield',
    label: 'Dividend Yield',
    category: 'fundamental',
    tooltip: 'Annual dividend as a percentage of stock price. Only relevant if the company pays dividends — high yields can signal value or distress.',
    getSignal: (v) => v == null || v === 0 ? 'neutral' : v > 0.02 ? 'bullish' : 'neutral',
    explain: (v) => {
      if (v == null || v === 0) return 'No dividend — growth-focused company that reinvests profits rather than distributing them.'
      const pct = (v * 100).toFixed(2)
      if (v > 0.05) return `${pct}% yield is high — attractive income but verify it's sustainable (check payout ratio and earnings coverage).`
      return `${pct}% dividend yield provides income to shareholders on top of any price appreciation.`
    },
  },

  {
    key: 'analystConsensus',
    label: 'Analyst Consensus',
    category: 'fundamental',
    tooltip: 'Consensus recommendation from Wall Street analysts. Useful context but analysts are often slow to update — treat as one signal among many.',
    getSignal: (_, ctx) => {
      const c = ctx?.analystConsensus
      if (c === 'Buy') return 'bullish'
      if (c === 'Sell') return 'bearish'
      return 'neutral'
    },
    explain: (_, ctx) => {
      const c = ctx?.analystConsensus
      const target = typeof ctx?.analystPriceTarget === 'number' ? ctx.analystPriceTarget : null
      const price = typeof ctx?.currentPrice === 'number' ? ctx.currentPrice : null
      if (!c || c === 'N/A') return 'No analyst data available.'
      const upside = (target && price)
        ? ` Avg. price target: $${Number(target).toFixed(2)} (${((Number(target) / Number(price) - 1) * 100).toFixed(1)}% from current).`
        : ''
      return `Analyst consensus is ${c}.${upside}`
    },
  },

  // ── Technical Metrics ─────────────────────────────────────────────────────

  {
    key: 'rsi',
    label: 'RSI (14)',
    category: 'technical',
    tooltip: 'Relative Strength Index: momentum oscillator. Above 70 = overbought (potential pullback). Below 30 = oversold (potential bounce). 30–70 = neutral.',
    getSignal: (v) => v == null ? 'neutral' : v > 70 ? 'bearish' : v < 30 ? 'bullish' : 'neutral',
    explain: (v) => {
      if (v == null) return 'RSI could not be calculated (insufficient data for the selected period).'
      if (v > 70) return `RSI of ${v.toFixed(1)} is overbought — momentum has been strong but a pullback or consolidation is statistically more common at these levels.`
      if (v < 30) return `RSI of ${v.toFixed(1)} is oversold — heavy selling may be exhausted; watch for a bounce or base-building.`
      return `RSI of ${v.toFixed(1)} is in the neutral range (30–70) — no extreme momentum in either direction. Trend-following conditions are typical here.`
    },
  },

  {
    key: 'macdSignal',
    label: 'MACD',
    category: 'technical',
    tooltip: 'MACD histogram: positive = bullish momentum, negative = bearish momentum. Crossovers (histogram flipping sign) signal potential trend shifts.',
    getSignal: (v) => v == null ? 'neutral' : v > 0 ? 'bullish' : 'bearish',
    explain: (v, ctx) => {
      if (v == null) return 'MACD could not be calculated (insufficient data for the selected period).'
      const crossover = ctx?.macdCrossover
      if (crossover === 'bullish') return 'MACD bullish crossover just occurred — the fast EMA crossed above the slow EMA, a potential trend shift upward.'
      if (crossover === 'bearish') return 'MACD bearish crossover just occurred — the fast EMA crossed below the slow EMA, a potential trend shift downward.'
      return v > 0
        ? 'MACD histogram is positive — bullish momentum is intact. The fast EMA is above the slow EMA.'
        : 'MACD histogram is negative — bearish momentum dominates. The fast EMA is below the slow EMA.'
    },
  },

  {
    key: 'sma50Deviation',
    label: 'Price vs SMA 50',
    category: 'technical',
    tooltip: 'How far current price is from its 50-day moving average. Price above = uptrend. Widely extended prices tend to revert toward the mean.',
    getSignal: (v) => {
      if (v == null) return 'neutral'
      if (v > 15) return 'bearish'
      if (v > 0) return 'bullish'
      if (v > -15) return 'neutral'
      return 'bearish'
    },
    explain: (v) => {
      if (v == null) return 'SMA 50 not available (insufficient data; need 50+ bars).'
      const sign = v >= 0 ? '+' : ''
      if (v > 15) return `Price is ${sign}${v.toFixed(1)}% above its 50-day SMA — significantly extended. Mean-reversion risk is elevated.`
      if (v > 0) return `Price is ${sign}${v.toFixed(1)}% above its 50-day SMA — in an uptrend, trading above medium-term support.`
      if (v > -15) return `Price is ${v.toFixed(1)}% below its 50-day SMA — testing or holding below medium-term support.`
      return `Price is ${v.toFixed(1)}% below its 50-day SMA — in a sustained downtrend relative to the medium-term average.`
    },
  },

  {
    key: 'sma200Deviation',
    label: 'Price vs SMA 200',
    category: 'technical',
    tooltip: 'Price vs. the 200-day moving average — the long-term trend benchmark used by institutions. Above = long-term uptrend.',
    getSignal: (v) => {
      if (v == null) return 'neutral'
      return v > 0 ? 'bullish' : 'bearish'
    },
    explain: (v, ctx) => {
      if (v == null) return 'SMA 200 not available (need 200+ bars; try 1Y or longer period).'
      const cross = ctx?.goldenDeathCross
      const sign = v >= 0 ? '+' : ''
      const base = v > 0
        ? `Price is ${sign}${v.toFixed(1)}% above the 200-day SMA — in a long-term uptrend.`
        : `Price is ${v.toFixed(1)}% below the 200-day SMA — in a long-term downtrend.`
      if (cross === 'golden') return `${base} Golden Cross (50-day above 200-day) — a historically bullish long-term signal.`
      if (cross === 'death') return `${base} Death Cross (50-day below 200-day) — a historically bearish long-term signal.`
      return base
    },
  },

  {
    key: 'bbPercentile',
    label: 'Bollinger Band Position',
    category: 'technical',
    tooltip: 'Where price sits within its 20-day Bollinger Bands. Above 85th percentile = extended to upside. Below 15th = compressed to downside.',
    getSignal: (v) => {
      if (v == null) return 'neutral'
      return v > 85 ? 'bearish' : v < 15 ? 'bullish' : 'neutral'
    },
    explain: (v) => {
      if (v == null) return 'Bollinger Bands not available (insufficient data).'
      if (v > 85) return `Price is at the ${v.toFixed(0)}th percentile of its Bollinger Band range — near the upper band. Statistically extended to the upside; mean-reversion probability increases.`
      if (v < 15) return `Price is at the ${v.toFixed(0)}th percentile of its Bollinger Band range — near the lower band. Statistically compressed; watch for a bounce.`
      return `Price is at the ${v.toFixed(0)}th percentile of its Bollinger Band range — within normal trading bounds, no extreme extension.`
    },
  },

  {
    key: 'volumeRatio',
    label: 'Volume Trend',
    category: 'technical',
    tooltip: 'Recent 5-day average volume vs. the 20-day average. High volume on moves adds conviction; low volume moves are less reliable.',
    getSignal: (v) => v == null ? 'neutral' : v > 1.5 ? 'bullish' : v < 0.5 ? 'bearish' : 'neutral',
    explain: (v) => {
      if (v == null) return 'Volume data not available.'
      const r = v.toFixed(2)
      if (v > 1.5) return `Volume is ${r}x the 20-day average — above-average participation adds conviction to recent price moves.`
      if (v < 0.5) return `Volume is only ${r}x the 20-day average — thin participation. Price moves on low volume are less reliable signals.`
      return `Volume is ${r}x the 20-day average — roughly normal trading activity.`
    },
  },

  {
    key: 'momentum3M',
    label: '3-Month Momentum',
    category: 'technical',
    tooltip: '3-month price return. The momentum factor (positive returns tend to persist) is one of the most empirically validated in academic finance.',
    getSignal: (v) => v == null ? 'neutral' : v > 10 ? 'bullish' : v < -10 ? 'bearish' : 'neutral',
    explain: (v) => {
      if (v == null) return '3-month momentum not available (need 63+ bars; try 6M or longer period).'
      const sign = v >= 0 ? '+' : ''
      const desc = v > 20 ? 'strong positive momentum' : v > 0 ? 'mild upward momentum' : v > -20 ? 'mild downward momentum' : 'significant downward momentum'
      return `3-month return of ${sign}${v.toFixed(1)}% — ${desc}. The momentum factor tends to persist over 3–12 month horizons.`
    },
  },

  {
    key: 'atr',
    label: 'ATR (14-day)',
    category: 'technical',
    tooltip: 'Average True Range: average daily price movement including gaps. Use for position sizing and setting stop-loss levels.',
    getSignal: () => 'neutral',
    explain: (v, ctx) => {
      if (v == null) return 'ATR not available (need 15+ bars).'
      const price = typeof ctx?.currentPrice === 'number' ? ctx.currentPrice : null
      const pct = price ? ((v / price) * 100).toFixed(2) : null
      return `ATR(14) of $${v.toFixed(2)}${pct ? ` (${pct}% of price daily)` : ''} — the average daily price swing. Use this to calibrate stop-loss distances and position sizing.`
    },
  },

  // ── Regime Metrics ────────────────────────────────────────────────────────

  {
    key: 'regimeLabel',
    label: 'Market Regime',
    category: 'regime',
    tooltip: 'Statistical regime classification using rolling momentum and volatility analysis — similar in spirit to Hidden Markov Model state detection.',
    getSignal: (_, ctx) => {
      const label = ctx?.regimeLabel
      if (label === 'Trending Up') return 'bullish'
      if (label === 'Trending Down') return 'bearish'
      return 'neutral'
    },
    explain: (_, ctx) => {
      const label = String(ctx?.regimeLabel ?? 'Unknown')
      const conf = Number(ctx?.regimeConfidence ?? 0)
      const days = Number(ctx?.regimeDays ?? 0)
      if (label === 'Trending Up') return `Regime: ${label} (${conf}% confidence, ~${days} periods). Directional upward momentum is statistically dominant — favorable environment for trend-following approaches.`
      if (label === 'Trending Down') return `Regime: ${label} (${conf}% confidence, ~${days} periods). Downward momentum dominates — mean-reversion setups carry higher risk in this environment.`
      return `Regime: ${label} (${conf}% confidence, ~${days} periods). Price is churning without a clear directional bias — breakout traders typically wait for this to resolve before committing.`
    },
  },

]
