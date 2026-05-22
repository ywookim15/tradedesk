import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()
export const dynamic = 'force-dynamic'

type FinnhubRec = {
  buy: number; hold: number; sell: number
  strongBuy: number; strongSell: number; period: string
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 })

  try {
    const [summary, quote] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: [
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'price',
          'summaryProfile',
        ],
      }),
      yf.quote(symbol),
    ])

    // ── Analyst rating from Finnhub ──────────────────────────────────────────
    let analystRating: {
      buy: number; hold: number; sell: number
      strongBuy: number; strongSell: number
      total: number; consensus: string; period: string
    } | null = null

    const finnhubKey = process.env.FINNHUB_API_KEY
    if (finnhubKey) {
      try {
        const res  = await fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`,
          { next: { revalidate: 3600 } },
        )
        const recs = (await res.json()) as FinnhubRec[]
        if (Array.isArray(recs) && recs.length > 0) {
          const r     = recs[0]
          const total = r.buy + r.hold + r.sell + r.strongBuy + r.strongSell
          const bull  = r.buy + r.strongBuy
          const bear  = r.sell + r.strongSell
          analystRating = {
            buy: r.buy, hold: r.hold, sell: r.sell,
            strongBuy: r.strongBuy, strongSell: r.strongSell,
            total,
            consensus: bull / total > 0.6 ? 'Buy' : bear / total > 0.4 ? 'Sell' : 'Hold',
            period: r.period,
          }
        }
      } catch { /* Finnhub is optional */ }
    }

    const sd = summary.summaryDetail
    const ks = summary.defaultKeyStatistics
    const fd = summary.financialData
    const pr = summary.price
    const sp = summary.summaryProfile

    return NextResponse.json({
      symbol,
      name:          pr?.longName ?? pr?.shortName ?? (quote as { longName?: string }).longName ?? symbol,
      sector:        sp?.sector   ?? null,
      industry:      sp?.industry ?? null,
      description:   sp?.longBusinessSummary?.slice(0, 400) ?? null,

      price:         (pr?.regularMarketPrice         ?? (quote as { regularMarketPrice?: number }).regularMarketPrice         ?? 0) as number,
      change:        (pr?.regularMarketChange        ?? (quote as { regularMarketChange?: number }).regularMarketChange        ?? 0) as number,
      changePercent: (pr?.regularMarketChangePercent ?? (quote as { regularMarketChangePercent?: number }).regularMarketChangePercent ?? 0) as number,

      peRatio:       (sd?.trailingPE  ?? null) as number | null,
      forwardPE:     (sd?.forwardPE   ?? null) as number | null,
      eps:           (ks?.trailingEps ?? null) as number | null,
      beta:          (sd?.beta ?? (ks as { beta?: number })?.beta ?? null) as number | null,
      dividendYield: (sd?.dividendYield ?? null) as number | null,
      marketCap:     (sd?.marketCap ?? (pr as { marketCap?: number })?.marketCap ?? null) as number | null,
      week52High:    (sd?.fiftyTwoWeekHigh ?? null) as number | null,
      week52Low:     (sd?.fiftyTwoWeekLow  ?? null) as number | null,
      revenue:       (fd?.totalRevenue     ?? null) as number | null,
      profitMargin:  (fd?.profitMargins ?? (ks as { profitMargins?: number })?.profitMargins ?? null) as number | null,
      roe:           (fd?.returnOnEquity   ?? null) as number | null,
      revenuePerShare: (fd?.revenuePerShare ?? null) as number | null,

      analystRating,
    })
  } catch (err) {
    console.error('[/api/stock/fundamentals]', err)
    return NextResponse.json({ error: 'Failed to fetch fundamentals' }, { status: 500 })
  }
}
