export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          plan: "free" | "pro";
          ai_queries_today: number;
          ai_queries_reset_date: string | null;
          theme: "dark" | "light";
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          plan?: "free" | "pro";
          ai_queries_today?: number;
          ai_queries_reset_date?: string | null;
          theme?: "dark" | "light";
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          plan?: "free" | "pro";
          ai_queries_today?: number;
          ai_queries_reset_date?: string | null;
          theme?: "dark" | "light";
          created_at?: string;
        };
      };
      watchlist: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          added_at?: string;
        };
      };
      portfolio: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          shares: number;
          avg_buy_price: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          shares: number;
          avg_buy_price: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          shares?: number;
          avg_buy_price?: number;
        };
      };
      journal: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          ticker: string;
          entry_price: number;
          exit_price: number;
          shares: number;
          pnl?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          ticker?: string;
          entry_price?: number;
          exit_price?: number;
          shares?: number;
          pnl?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
