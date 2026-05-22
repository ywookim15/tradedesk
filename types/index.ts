export type { Database } from "./database";

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52?: number;
  low52?: number;
}

export interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePercent: number;
  sparkline?: number[];
}

export interface StockCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary?: string;
}

export interface FundamentalData {
  ticker: string;
  name: string;
  price: number;
  peRatio?: number;
  eps?: number;
  roe?: number;
  beta?: number;
  dividendYield?: number;
  marketCap?: number;
  high52?: number;
  low52?: number;
  revenue?: number;
  profitMargin?: number;
  analystRating?: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  analystScore?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  ticker: string;
  entry_price: number;
  exit_price: number;
  shares: number;
  pnl: number;
  notes: string | null;
  created_at: string;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  ticker: string;
  shares: number;
  avg_buy_price: number;
  currentPrice?: number;
  currentValue?: number;
  costBasis?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

export type AssistantStatus = "idle" | "listening" | "thinking" | "speaking";
