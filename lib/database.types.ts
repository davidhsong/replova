// Auto-generated types for the Replova Supabase schema.
// Covers both pre-existing tables (restaurants, reviews) and tables
// added in migrations 001–005.

// ─────────────────────────────────────────────────────────────
// Accounts table (migration 005): one row per user/owner_email
// ─────────────────────────────────────────────────────────────

export interface Account {
  id: string
  owner_email: string
  auth_user_id: string | null
  plan: 'starter' | 'growth' | 'agency'
  stripe_customer_id: string | null
  terms_accepted_at: string | null
  created_at: string
}

export interface BusinessWorkspace {
  id: string
  account_id: string
  name: string
  status: 'active' | 'archived'
  provisioning_source: 'manual' | 'legacy_backfill' | 'system'
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────
// Existing tables
// ─────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string
  workspace_id: string | null
  name: string
  place_id: string | null
  owner_email: string
  active: boolean
  cuisine_type: string | null
  report_logo_url: string | null   // Agency white-label reports (migration 005)
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null  // Unix ms
  google_location_name: string | null     // e.g. "accounts/123/locations/456"
  created_at: string
}

export interface YouTubeConnection {
  id: string
  user_id: string
  channel_id: string
  channel_title: string | null
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: number
  granted_scopes: string[]
  created_at: string
  updated_at: string
}

export interface YouTubeChannelProfile {
  connection_id: string
  channel_id: string
  title: string
  avatar_url: string | null
  channel_url: string
  uploads_playlist_id: string
  subscriber_count: number | null
  video_count: number | null
  view_count: number | null
  subscriber_count_hidden: boolean
  catalog_partial: boolean
  synced_at: string
  updated_at: string
}

export interface YouTubeVideo {
  id: string
  connection_id: string
  video_id: string
  channel_id: string
  title: string
  description: string
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  comment_count: number | null
  privacy_status: 'public' | 'unlisted' | 'private' | null
  upload_position: number | null
  is_available: boolean
  synced_at: string
  created_at: string
  updated_at: string
}

export interface YouTubePlaylist {
  id: string
  connection_id: string
  playlist_id: string
  channel_id: string
  title: string
  description: string
  thumbnail_url: string | null
  published_at: string | null
  item_count: number
  is_active: boolean
  membership_complete: boolean
  membership_synced_at: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

export interface YouTubePlaylistVideo {
  connection_id: string
  playlist_id: string
  video_id: string
  position: number
  synced_at: string
}

export interface YouTubeAutomationSettings {
  id: string
  connection_id: string
  automation_enabled: boolean
  auto_publish_enabled: boolean
  auto_publish_authorized_at: string | null
  auto_publish_authorized_by: string | null
  auto_publish_consent_version: string | null
  auto_publish_consent_scope_hash: string | null
  auto_publish_revoked_at: string | null
  publishing_mode: 'manual_approval' | 'auto_publish'
  emergency_paused: boolean
  category_rules: Record<string, unknown>
  max_comments_per_sync: number
  max_drafts_per_run: number
  max_draft_attempts: number
  max_publish_attempts: number
  max_auto_publishes_per_day: number
  min_auto_publish_confidence: number
  reply_delay_minutes: number
  commenter_cooldown_hours: number
  eligible_video_filter_mode: 'all' | 'include' | 'exclude'
  eligible_video_ids: string[]
  created_at: string
  updated_at: string
}

export type YouTubeQueueState =
  | 'discovered' | 'queued_for_draft' | 'generating' | 'awaiting_approval'
  | 'ready_to_publish' | 'publishing' | 'published' | 'rejected' | 'skipped'
  | 'draft_failed' | 'publish_failed' | 'publish_uncertain'

export type YouTubeApprovalStatus = 'pending' | 'approved' | 'rejected' | 'not_required'
export type YouTubeReplyVerificationStatus = 'unknown' | 'verified_unpublished' | 'verified_published'

export interface YouTubeCommentQueue {
  id: string
  connection_id: string
  youtube_comment_id: string
  youtube_thread_id: string
  video_id: string
  author_channel_id: string | null
  author_display_name: string | null
  comment_text: string
  comment_published_at: string
  comment_updated_at: string | null
  reply_count: number
  category: string | null
  category_confidence: number | null
  processing_state: YouTubeQueueState
  approval_status: YouTubeApprovalStatus
  generated_reply: string | null
  edited_reply: string | null
  scheduled_publish_at: string | null
  published_reply_id: string | null
  published_reply_url: string | null
  published_at: string | null
  draft_attempts: number
  publish_attempts: number
  next_attempt_at: string | null
  last_attempt_at: string | null
  lock_token: string | null
  locked_by: string | null
  locked_at: string | null
  lease_expires_at: string | null
  publish_result_uncertain: boolean
  reply_verification_status: YouTubeReplyVerificationStatus
  reply_verification_checked_at: string | null
  reply_verification_error: string | null
  requires_manual_review: boolean
  manual_review_reason: string | null
  knowledge_entry_ids: string[]
  knowledge_context_used_at: string | null
  last_error_stage: string | null
  last_error_code: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
}

export type YouTubeAutomationEventType =
  | 'sync_started' | 'sync_succeeded' | 'sync_failed' | 'comment_discovered'
  | 'draft_started' | 'draft_succeeded' | 'draft_failed' | 'draft_edited' | 'approval_changed'
  | 'publish_attempted' | 'publish_succeeded' | 'publish_failed'
  | 'publish_uncertain' | 'worker_lease_expired'
  | 'settings_updated' | 'consent_granted' | 'consent_revoked' | 'consent_invalidated'
  | 'automation_paused' | 'automation_resumed'

export interface YouTubeAutomationLog {
  id: string
  connection_id: string
  queue_id: string | null
  run_id: string
  event_type: YouTubeAutomationEventType
  severity: 'debug' | 'info' | 'warning' | 'error'
  attempt_number: number | null
  idempotency_key: string | null
  message: string | null
  error_code: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface YouTubeAutoPublishDailyUsage {
  connection_id: string
  usage_date: string
  reserved_count: number
  published_count: number
  created_at: string
  updated_at: string
}

export interface YouTubeAutomationRuntime {
  connection_id: string
  sync_page_token: string | null
  sync_cycle_started_at: string | null
  last_sync_at: string | null
  last_draft_at: string | null
  lease_token: string | null
  leased_by: string | null
  leased_at: string | null
  lease_expires_at: string | null
  last_run_id: string | null
  last_error_code: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  owner_user_id: string
  provider: string
  provider_connection_id: string
  display_name: string | null
  description: string
  response_guidelines: string
  created_at: string
  updated_at: string
}

export interface KnowledgeEntry {
  id: string
  knowledge_base_id: string
  owner_user_id: string
  entry_type: 'faq' | 'fact' | 'video_context'
  title: string
  content: string
  scope_type: 'general' | 'youtube_video'
  scope_key: string | null
  source_title: string | null
  source_description: string | null
  source_fetched_at: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  restaurant_id: string
  google_review_name: string | null       // GMB canonical name, used for dedup
  places_dedupe_key: string | null         // Generated key for Places sample dedup
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
  processing_started_at: string | null
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
  website: string | null
  price_level: number | null
  cuisine_tags: string[] | null
  source: 'manual' | 'auto' | null
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
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'auth_user_id'> & Partial<Pick<Account, 'auth_user_id'>>
        Update: Partial<Omit<Account, 'id' | 'created_at'>>
      }
      business_workspaces: {
        Row: BusinessWorkspace
        Insert: Pick<BusinessWorkspace, 'account_id' | 'name'> & Partial<Omit<BusinessWorkspace, 'id' | 'account_id' | 'name' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<BusinessWorkspace, 'id' | 'account_id' | 'created_at' | 'updated_at'>>
      }
      restaurants: {
        Row: Restaurant
        Insert: Omit<Restaurant, 'id' | 'created_at' | 'workspace_id'> & Partial<Pick<Restaurant, 'workspace_id'>>
        Update: Partial<Omit<Restaurant, 'id' | 'created_at'>>
      }
      youtube_connections: {
        Row: YouTubeConnection
        Insert: Omit<YouTubeConnection, 'id' | 'created_at'> & { created_at?: string; updated_at?: string }
        Update: Partial<Omit<YouTubeConnection, 'id' | 'user_id' | 'created_at'>>
      }
      youtube_channel_profiles: {
        Row: YouTubeChannelProfile
        Insert: YouTubeChannelProfile
        Update: Partial<Omit<YouTubeChannelProfile, 'connection_id' | 'channel_id'>>
      }
      youtube_videos: {
        Row: YouTubeVideo
        Insert: Omit<YouTubeVideo, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<YouTubeVideo, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<YouTubeVideo, 'id' | 'connection_id' | 'video_id' | 'created_at' | 'updated_at'>>
      }
      youtube_playlists: {
        Row: YouTubePlaylist
        Insert: Omit<YouTubePlaylist, 'id' | 'created_at' | 'updated_at' | 'membership_synced_at'> & Partial<Pick<YouTubePlaylist, 'id' | 'created_at' | 'updated_at' | 'membership_synced_at'>>
        Update: Partial<Omit<YouTubePlaylist, 'id' | 'connection_id' | 'playlist_id' | 'created_at' | 'updated_at'>>
      }
      youtube_playlist_videos: {
        Row: YouTubePlaylistVideo
        Insert: YouTubePlaylistVideo
        Update: Partial<Pick<YouTubePlaylistVideo, 'position' | 'synced_at'>>
      }
      youtube_automation_settings: {
        Row: YouTubeAutomationSettings
        Insert: { connection_id: string } & Partial<Omit<YouTubeAutomationSettings, 'id' | 'connection_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<YouTubeAutomationSettings, 'id' | 'connection_id' | 'created_at' | 'updated_at'>>
      }
      youtube_comment_queue: {
        Row: YouTubeCommentQueue
        Insert: Pick<YouTubeCommentQueue, 'connection_id' | 'youtube_comment_id' | 'youtube_thread_id' | 'video_id' | 'comment_text' | 'comment_published_at'> & Partial<Omit<YouTubeCommentQueue, 'id' | 'connection_id' | 'youtube_comment_id' | 'youtube_thread_id' | 'video_id' | 'comment_text' | 'comment_published_at' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<YouTubeCommentQueue, 'id' | 'connection_id' | 'youtube_comment_id' | 'created_at'>>
      }
      youtube_automation_logs: {
        Row: YouTubeAutomationLog
        Insert: Pick<YouTubeAutomationLog, 'connection_id' | 'event_type'> & Partial<Omit<YouTubeAutomationLog, 'id' | 'connection_id' | 'event_type' | 'created_at'>>
        Update: never
      }
      youtube_auto_publish_daily_usage: {
        Row: YouTubeAutoPublishDailyUsage
        Insert: Pick<YouTubeAutoPublishDailyUsage, 'connection_id'> & Partial<Omit<YouTubeAutoPublishDailyUsage, 'connection_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Pick<YouTubeAutoPublishDailyUsage, 'reserved_count' | 'published_count'>>
      }
      youtube_automation_runtime: {
        Row: YouTubeAutomationRuntime
        Insert: Pick<YouTubeAutomationRuntime, 'connection_id'> & Partial<Omit<YouTubeAutomationRuntime, 'connection_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<YouTubeAutomationRuntime, 'connection_id' | 'created_at' | 'updated_at'>>
      }
      knowledge_bases: {
        Row: KnowledgeBase
        Insert: Pick<KnowledgeBase, 'owner_user_id' | 'provider' | 'provider_connection_id'> & Partial<Omit<KnowledgeBase, 'id' | 'owner_user_id' | 'provider' | 'provider_connection_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<KnowledgeBase, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>
      }
      knowledge_entries: {
        Row: KnowledgeEntry
        Insert: Pick<KnowledgeEntry, 'knowledge_base_id' | 'owner_user_id' | 'entry_type' | 'title'> & Partial<Omit<KnowledgeEntry, 'id' | 'knowledge_base_id' | 'owner_user_id' | 'entry_type' | 'title' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<KnowledgeEntry, 'id' | 'knowledge_base_id' | 'owner_user_id' | 'created_at' | 'updated_at'>>
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
