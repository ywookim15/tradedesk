import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

const SECTORS = [
  { symbol: 'XLK',  name: 'Technology'             },
  { symbol: 'XLV',  name: 'Healthcare'              },
  { symbol: 'XLF',  name: 'Financials'              },
  { symbol: 'XLY',  name: 'Cons. Discretionary'     },
  { symbol: 'XLP',  name: 'Cons. Staples'           },
  { symbol: 'XLE',  name: 'Energy'                  },
  { symbol: 'XLI',  name: 'Industrials'             },
  { symbol: 'XLB',  name: 'Materials'               },
  { symbol: 'XLU',  name: 'Utilities'               },
  { symbol: 'XLRE', name: 'Real Estate'             },
  { symbol: 'XLC',  name: 'Comm. Services'          },
]

export async function GET() {
  try {
    type Q = { symbol?: string; regularMarketChangePercent?: number; regularMarketPrice?: number }
    const symbols = SECTORS.map((s) => s.symbol)
    const quotes  = await yahooFinance.quote(symbols) as unknown as Q[]

    const quoteList = Array.isArray(quotes) ? quotes : [quotes]
    const quoteMap = Object.fromEntries(quoteList.map((q) => [q.symbol, q]))

    const result = SECTORS.map((sector) => {
      const q = quoteMap[sector.symbol]
      return {
        symbol:        sector.symbol,
        name:          sector.name,
        changePercent: q?.regularMarketChangePercent ?? 0,
        price:         q?.regularMarketPrice         ?? 0,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/market/sectors]', err)
    return NextResponse.json({ error: 'Failed to fetch sectors' }, { status: 500 })
  }
}
