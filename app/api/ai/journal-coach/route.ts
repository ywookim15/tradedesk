import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geminiJSON } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

const MIN_TRADES = 5

type Trade = {
  id: string
  date: string
  ticker: string
  entry_price: number
  exit_price: number
  shares: number
  pnl: number
  notes: string
}

// ── Pre-compute stats the model can use directly ───────────────────────────────

function preComputeStats(trades: Trade[]) {
  const total = trades.length
  const wins  = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const winRate = (wins.length / total) * 100
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)

  // By day of week (0=Sun, 1=Mon … 6=Sat)
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDow: Record<string, { wins: number; total: number; pnl: number }> = {}
  for (const t of trades) {
    const d = DOW[new Date(t.date).getDay()]
    if (!byDow[d]) byDow[d] = { wins: 0, total: 0, pnl: 0 }
    byDow[d].total++
    byDow[d].pnl += t.pnl
    if (t.pnl > 0) byDow[d].wins++
  }

  // By ticker
  const byTicker: Record<string, { wins: number; total: number; pnl: number }> = {}
  for (const t of trades) {
    if (!byTicker[t.ticker]) byTicker[t.ticker] = { wins: 0, total: 0, pnl: 0 }
    byTicker[t.ticker].total++
    byTicker[t.ticker].pnl += t.pnl
    if (t.pnl > 0) byTicker[t.ticker].wins++
  }

  const sortedTickers = Object.entries(byTicker).sort((a, b) => b[1].pnl - a[1].pnl)

  // Risk/reward
  const avgGain = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0
  const rrRatio = avgLoss > 0 ? avgGain / avgLoss : null

  // Largest win/loss
  const sortedByPnl = [...trades].sort((a, b) => b.pnl - a.pnl)
  const biggestWin  = sortedByPnl[0]
  const biggestLoss = sortedByPnl[sortedByPnl.length - 1]

  // Streak analysis
  let curStreak = 0; let maxWinStreak = 0; let maxLossStreak = 0
  const sortedByDate = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sortedByDate) {
    if (t.pnl > 0) {
      curStreak = Math.max(curStreak + 1, 1)
      maxWinStreak = Math.max(maxWinStreak, curStreak)
    } else {
      curStreak = Math.min(curStreak - 1, -1)
      maxLossStreak = Math.max(maxLossStreak, Math.abs(curStreak))
    }
  }

  // Recent form: last 5 trades
  const recent = sortedByDate.slice(-5)
  const recentWins = recent.filter(t => t.pnl > 0).length

  return {
    total, winRate, totalPnl, avgGain, avgLoss, rrRatio,
    biggestWin, biggestLoss,
    maxWinStreak, maxLossStreak,
    recentWins, recentTotal: recent.length,
    byDow, byTicker, sortedTickers,
  }
}

export type CoachReport = {
  winRateSummary: string
  bestDay: string
  worstDay: string
  topTicker: string
  worstTicker: string
  rrRatio: string
  avgGain: string
  avgLoss: string
  patterns: string[]
  recommendations: string[]
  encouragement: string
  overallSummary: string
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Fetch all trades ────────────────────────────────────────────────────
    const { data: trades, error } = await supabase
      .from('journal')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!trades || trades.length < MIN_TRADES) {
      return NextResponse.json({ tooFewTrades: true, count: trades?.length ?? 0 })
    }

    const stats = preComputeStats(trades as Trade[])

    // ── Build prompt ────────────────────────────────────────────────────────
    const dowSummary = Object.entries(stats.byDow)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([day, d]) => `${day}: ${d.total} trades, ${((d.wins / d.total) * 100).toFixed(0)}% win rate, $${d.pnl.toFixed(2)} total P&L`)
      .join('\n')

    const tickerSummary = stats.sortedTickers.slice(0, 8)
      .map(([t, d]) => `${t}: ${d.total} trades, ${((d.wins / d.total) * 100).toFixed(0)}% win rate, $${d.pnl.toFixed(2)} total P&L`)
      .join('\n')

    const recentTrades = (trades as Trade[])
      .slice(-10)
      .map(t => `${t.date} | ${t.ticker} | Entry $${t.entry_price} → Exit $${t.exit_price} | ${t.shares} shares | P&L: ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} | Notes: "${t.notes || 'none'}"`)
      .join('\n')

    const prompt = `You are an expert trading coach analyzing a trader's journal. Be specific, direct, and actionable. Do NOT give generic advice — everything must be rooted in the data below.

TRADING JOURNAL STATISTICS
Total trades: ${stats.total}
Win rate: ${stats.winRate.toFixed(1)}% (${(trades as Trade[]).filter(t => t.pnl > 0).length} wins, ${(trades as Trade[]).filter(t => t.pnl <= 0).length} losses)
Total P&L: ${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}
Average gain (winners): $${stats.avgGain.toFixed(2)}
Average loss (losers): -$${stats.avgLoss.toFixed(2)}
Risk/Reward ratio: ${stats.rrRatio != null ? stats.rrRatio.toFixed(2) + ':1' : 'N/A'}
Biggest win: ${stats.biggestWin ? `$${stats.biggestWin.pnl.toFixed(2)} on ${stats.biggestWin.ticker} (${stats.biggestWin.date})` : 'N/A'}
Biggest loss: ${stats.biggestLoss ? `$${stats.biggestLoss.pnl.toFixed(2)} on ${stats.biggestLoss.ticker} (${stats.biggestLoss.date})` : 'N/A'}
Longest win streak: ${stats.maxWinStreak} in a row
Longest loss streak: ${stats.maxLossStreak} in a row
Recent form (last 5): ${stats.recentWins}/${stats.recentTotal} wins

PERFORMANCE BY DAY OF WEEK:
${dowSummary}

PERFORMANCE BY TICKER:
${tickerSummary}

LAST 10 TRADES (most recent):
${recentTrades}

INSTRUCTIONS:
Analyze this data deeply and return a JSON coaching report. Be specific — name actual tickers, days, and amounts from the data. Keep each string under 120 characters.

Return ONLY this JSON (no markdown, no code fences):
{
  "winRateSummary": "One sentence summarizing overall win rate and what it implies",
  "bestDay": "Best performing day of week with specific win rate from data",
  "worstDay": "Worst performing day of week with specific win rate from data",
  "topTicker": "Best performing ticker with specific P&L and win rate from data",
  "worstTicker": "Worst performing ticker with specific P&L from data",
  "rrRatio": "Plain-English interpretation of the risk/reward ratio",
  "avgGain": "Plain-English note about average gains",
  "avgLoss": "Plain-English note about average losses",
  "patterns": [
    "Specific behavioral pattern 1 from the data (e.g. 'You tend to overtrade on Fridays — only 33% win rate')",
    "Specific behavioral pattern 2",
    "Specific behavioral pattern 3"
  ],
  "recommendations": [
    "Specific actionable recommendation 1 based on the data",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "encouragement": "One specific, genuine encouraging observation from the data",
  "overallSummary": "2-3 sentence overall assessment of this trader's performance and biggest opportunity"
}`

    // ── Call Gemini ─────────────────────────────────────────────────────────
    let rawResponse: string
    try {
      rawResponse = await geminiJSON(prompt)
    } catch {
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 503 })
    }

    // ── Parse response ──────────────────────────────────────────────────────
    const clean = rawResponse.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    const start = clean.indexOf('{')
    const end   = clean.lastIndexOf('}')

    if (start === -1 || end <= start) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    try {
      const report = JSON.parse(clean.slice(start, end + 1)) as CoachReport
      return NextResponse.json({ report, stats: {
        total: stats.total,
        winRate: stats.winRate,
        totalPnl: stats.totalPnl,
        avgGain: stats.avgGain,
        avgLoss: stats.avgLoss,
        rrRatio: stats.rrRatio,
        maxWinStreak: stats.maxWinStreak,
        maxLossStreak: stats.maxLossStreak,
        recentWins: stats.recentWins,
        recentTotal: stats.recentTotal,
      }})
    } catch {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

  } catch (err) {
    console.error('[/api/ai/journal-coach]', err)
    return NextResponse.json({ error: 'Coach failed' }, { status: 500 })
  }
}
