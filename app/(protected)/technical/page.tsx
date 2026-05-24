import { redirect } from 'next/navigation'

export default function TechnicalPage({
  searchParams,
}: {
  searchParams: { ticker?: string }
}) {
  const ticker = searchParams.ticker
  redirect(ticker ? `/stock-analysis?ticker=${ticker}` : '/stock-analysis')
}
