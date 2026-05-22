import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

const INDICES = [
  { symbol: '^GSPC',  name: 'S&P 500',   short: 'SPX'    },
  { symbol: '^IXIC',  name: 'NASDAQ',     short: 'COMP'   },
  { symbol: '^DJI',   name: 'Dow Jones',  short: 'DJI'    },
  { symbol: '^VIX',   name: 'Volatility', short: 'VIX'    },
]

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const to   = new Date()
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days → ~7 trading days

    const results = await Promise.all(
      INDICES.map(async (idx) => {
        try {
          const [quote, history] = await Promise.all([
            yahooFinance.quote(idx.symbol) as Promise<Record<string, number>>,
            yahooFinance.historical(idx.symbol, {
              period1:  toDateStr(from),
              period2:  toDateStr(to),
              interval: '1d',
            }) as Promise<Array<{ close: number }>>,
          ])

          return {
            symbol:        idx.symbol,
            name:          idx.name,
            short:         idx.short,
            value:         quote.regularMarketPrice         ?? 0,
            change:        quote.regularMarketChange        ?? 0,
            changePercent: quote.regularMarketChangePercent ?? 0,
            sparkline:     history.map((h) => h.close ?? 0).filter(Boolean),
          }
        } catch {
          return {
            symbol:        idx.symbol,
            name:          idx.name,
            short:         idx.short,
            value:         0,
            change:        0,
            changePercent: 0,
            sparkline:     [],
            error:         true,
          }
        }
      }),
    )

    return NextResponse.json(results)
  } catch (err) {
    console.error('[/api/market/indices]', err)
    return NextResponse.json({ error: 'Failed to fetch indices' }, { status: 500 })
  }
}
