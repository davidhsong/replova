// Auto-generated types for the Replova Supabase schema.
// Covers both pre-existing tables (restaurants, reviews) and tables
// added in migration 001_core_schema.sql.

// ─────────────────────────────────────────────────────────────
// Existing tables
// ─────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string
  name: string
  place_id: string | null
  owner_email: string
  active: boolean
  stripe_customer_id: string | null
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null  // Unix ms
  google_location_name: string | null     // e.g. "accounts/123/locations/456"
  created_at: string
}

export interface Review {
  id: string
  restaurant_id: string
  google_review_name: string | null       // GMB canonical name, used for dedup
  author: string | null
  rating: number | null                   // 1–5
  review_text: string | null
  review_timestamp: number | null         // Unix seconds
  reply_draft_1: string | null            // Professional
  reply_draft_2: string | null            // Warm
  reply_draft_3: string | null            // Brief
  status: 'pending' | 'drafted' | 'emailed' | 'replied'
  replied_at: string | null
  created_at: string
  // Added by migration 001
  sentiment_score: number | null          // -1.0 to 1.0
  sentiment_label: 'positive' | 'neutral' | 'negative' | null
  sentiment_summary: string | null        // 1-sentence AI summary
  keywords: string[] | null
  staff_mentions: string[] | null
  menu_mentions: string[] | null
}

// ─────────────────────────────────────────────────────────────
// New tables (migration 001)
// ─────────────────────────────────────────────────────────────

export interface RestaurantSettings {
  id: string
  restaurant_id: string
  auto_reply_enabled: boolean
  auto_reply_delay_hours: number
  reply_persona: string | null
  notify_negative_reviews: boolean
  negative_threshold: number
  digest_enabled: boolean
  digest_day: number                      // 0=Sun … 6=Sat
  recovery_offer_enabled: boolean
  recovery_offer_text: string | null
  created_at: string
}

export interface ReplyQueue {
  id: string
  review_id: string
  restaurant_id: string
  generated_reply: string
  edited_reply: string | null
  scheduled_send_at: string | null
  sent: boolean
  sent_at: string | null
  approved: boolean | null                // null=pending, true=approved, false=rejected
  created_at: string
}

export interface ReputationScore {
  id: string
  restaurant_id: string
  score: number | null                    // 0–100 composite score
  avg_rating: number | null
  total_reviews: number | null
  reviews_this_month: number | null
  response_rate: number | null            // 0–1
  avg_sentiment: number | null
  score_date: string                      // ISO date string YYYY-MM-DD
  created_at: string
}

export interface ReviewRequest {
  id: string
  restaurant_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  channel: 'email' | 'sms'
  status: 'pending' | 'sent' | 'opened' | 'clicked'
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  review_link: string | null
  created_at: string
}

export interface Competitor {
  id: string
  restaurant_id: string
  name: string
  google_place_id: string
  address: string | null
  active: boolean
  created_at: string
}

export interface CompetitorSnapshot {
  id: string
  competitor_id: string
  avg_rating: number | null
  total_reviews: number | null
  snapshot_date: string                   // ISO date string YYYY-MM-DD
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Supabase Database type (for createClient<Database>(...))
// ─────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant
        Insert: Omit<Restaurant, 'id' | 'created_at'>
        Update: Partial<Omit<Restaurant, 'id' | 'created_at'>>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at'>
        Update: Partial<Omit<Review, 'id' | 'created_at'>>
      }
      restaurant_settings: {
        Row: RestaurantSettings
        Insert: Omit<RestaurantSettings, 'id' | 'created_at'>
        Update: Partial<Omit<RestaurantSettings, 'id' | 'created_at'>>
      }
      reply_queue: {
        Row: ReplyQueue
        Insert: Omit<ReplyQueue, 'id' | 'created_at'>
        Update: Partial<Omit<ReplyQueue, 'id' | 'created_at'>>
      }
      reputation_scores: {
        Row: ReputationScore
        Insert: Omit<ReputationScore, 'id' | 'created_at'>
        Update: Partial<Omit<ReputationScore, 'id' | 'created_at'>>
      }
      review_requests: {
        Row: ReviewRequest
        Insert: Omit<ReviewRequest, 'id' | 'created_at'>
        Update: Partial<Omit<ReviewRequest, 'id' | 'created_at'>>
      }
      competitors: {
        Row: Competitor
        Insert: Omit<Competitor, 'id' | 'created_at'>
        Update: Partial<Omit<Competitor, 'id' | 'created_at'>>
      }
      competitor_snapshots: {
        Row: CompetitorSnapshot
        Insert: Omit<CompetitorSnapshot, 'id' | 'created_at'>
        Update: Partial<Omit<CompetitorSnapshot, 'id' | 'created_at'>>
      }
    }
  }
}
