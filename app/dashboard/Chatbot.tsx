'use client'

import { useState, useRef, useEffect } from 'react'

interface BotResponse {
  text: string
  link?: { label: string; href: string }
}

interface Message {
  role: 'user' | 'bot'
  text: string
  link?: { label: string; href: string }
}

interface ChatContext {
  restaurantName: string
  userEmail: string
  plan: string
  locationCount: number
  trialEndDate: string
  renewalDate: string | null
  subscriptionStatus: string
  googleConnected: boolean
  googleLocationName: string | null
  reputationScore: number | null
  avgRating: number | null
  totalReviews: number | null
  reviewsThisMonth: number | null
  responseRate: number | null
  avgSentiment: number | null
  awaitingReplyCount: number
  autoReplyEnabled: boolean
  autoReplyDelayHours: number
  replyPersona: string | null
  notifyNegativeReviews: boolean
  negativeThreshold: number
}

const PLAN_PRICE: Record<string, string> = {
  starter: '$79/mo',
  growth: '$179/mo',
  agency: '$349/mo',
}

const CHIPS = [
  { label: 'My business info', input: 'Tell me about my account' },
  { label: 'Connect Google', input: 'How do I connect Google Business?' },
  { label: 'Upgrade my plan', input: 'What plan am I on?' },
  { label: 'Track a competitor', input: 'How do I track a competitor?' },
]

function m(q: string, ...terms: string[]): boolean {
  return terms.some(t => q.includes(t))
}

function pct(rate: number | null): string | null {
  if (rate === null) return null
  return `${Math.round(rate * 100)}%`
}

function getResponse(input: string, ctx: ChatContext): BotResponse {
  const q = input.toLowerCase().trim()
  const planLabel = ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1)
  const planPrice = PLAN_PRICE[ctx.plan] ?? ''

  // ── Account overview ─────────────────────────────────────────────────────

  if (m(q, 'tell me about my account', 'my account', 'account overview', 'account summary', 'account info', 'account details')) {
    const rating = ctx.avgRating ? `${ctx.avgRating.toFixed(1)}★` : 'N/A'
    const score = ctx.reputationScore !== null ? `${ctx.reputationScore}/100` : 'N/A (Growth/Agency)'
    const google = ctx.googleConnected ? 'Connected' : 'Not connected'
    return {
      text: `${ctx.restaurantName} | ${planLabel} plan (${planPrice})\n\nGoogle: ${google}\nReputation score: ${score}\nGoogle rating: ${rating}\nTotal reviews: ${ctx.totalReviews ?? 0}\nAwaiting reply: ${ctx.awaitingReplyCount}\nAuto-reply: ${ctx.autoReplyEnabled ? `ON (${ctx.autoReplyDelayHours}h delay)` : 'OFF'}\nAccount email: ${ctx.userEmail}`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Business / restaurant name ────────────────────────────────────────────

  if (
    m(q, 'my business name', 'my restaurant name', 'restaurant called', 'business called', 'what restaurant', 'restaurant am i', 'business am i', "what's my restaurant", "what's my business", 'what practice', 'my practice', 'practice called') ||
    q === 'my name' || q === 'what is my name' || q === "what's my name"
  ) {
    return { text: `Your business is called "${ctx.restaurantName}".` }
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  if (m(q, 'my email', 'account email', 'email address', 'what email', "what's my email", 'my login email', 'email i use', 'my login')) {
    return { text: `Your account email is ${ctx.userEmail}.` }
  }

  // ── Plan / subscription ───────────────────────────────────────────────────

  if (m(q, 'my plan', 'current plan', 'what plan', 'which plan', 'my subscription', 'my tier', 'am i on the', 'what am i paying', 'my current plan', 'plan am i on', 'am i subscribed')) {
    const upsell =
      ctx.plan === 'starter' ? ' You can upgrade to Growth or Agency for more features.'
      : ctx.plan === 'growth' ? ' Upgrade to Agency to unlock custom persona and white-label reports.'
      : " You're on our top tier. All features are unlocked."
    const renewal = ctx.renewalDate ? ` Renews on ${ctx.renewalDate}.` : ` Trial ends ${ctx.trialEndDate}.`
    return {
      text: `You're on the ${planLabel} plan (${planPrice}).${renewal}${upsell}`,
      link: { label: 'View Billing', href: '/dashboard/billing' },
    }
  }

  // ── Subscription renewal / billing cycle ──────────────────────────────────

  if (m(q, 'when does my subscription renew', 'renewal date', 'next billing', 'next charge', 'when am i billed', 'next payment', 'billing cycle', 'when will i be charged', 'when do i get charged', 'billing date', 'renew', 'subscription renew')) {
    if (ctx.subscriptionStatus === 'past_due') {
      return {
        text: `Your last payment failed. Your subscription is currently past due. Please update your payment method immediately to avoid service interruption.`,
        link: { label: 'Update Payment Method', href: '/dashboard/billing' },
      }
    }
    if (ctx.subscriptionStatus === 'canceled') {
      return {
        text: `Your subscription has been canceled. You can reactivate by choosing a plan on the Billing page.`,
        link: { label: 'Go to Billing', href: '/dashboard/billing' },
      }
    }
    if (ctx.renewalDate) {
      return {
        text: `Your ${planLabel} plan (${planPrice}) renews on ${ctx.renewalDate}.`,
        link: { label: 'Manage Subscription', href: '/dashboard/billing' },
      }
    }
    return {
      text: `You're currently in your free trial, which ends on ${ctx.trialEndDate}. Your first charge will be ${planPrice} after the trial unless you cancel.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  // ── Subscription status ───────────────────────────────────────────────────

  if (m(q, 'subscription status', 'payment status', 'my payment', 'payment failed', 'past due', 'account status', 'is my subscription active')) {
    const statusMap: Record<string, string> = {
      active: `Active: your ${planLabel} plan is in good standing and renews on ${ctx.renewalDate ?? 'the next billing date'}.`,
      trialing: `In free trial, ends on ${ctx.trialEndDate}. No charge until then.`,
      past_due: `Past due. Your last payment failed. Please update your payment method to restore full access.`,
      canceled: `Canceled. Your subscription has ended. Reactivate on the Billing page.`,
      unpaid: `Unpaid. Your subscription is suspended due to a failed payment. Update your payment method immediately.`,
    }
    const msg = statusMap[ctx.subscriptionStatus] ?? `Status: ${ctx.subscriptionStatus}. Check the Billing page for details.`
    return {
      text: msg,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  // ── Trial ─────────────────────────────────────────────────────────────────

  if (m(q, 'my trial', 'trial end', 'trial expire', 'trial left', 'days left in trial', 'when does my trial', 'is my trial', 'trial still active', 'how long trial', 'trial period', 'free trial')) {
    if (ctx.renewalDate && ctx.subscriptionStatus === 'active') {
      return {
        text: `Your trial has converted to an active ${planLabel} subscription. Your next charge is on ${ctx.renewalDate}.`,
        link: { label: 'Go to Billing', href: '/dashboard/billing' },
      }
    }
    return {
      text: `Your free trial ends on ${ctx.trialEndDate}. After that, your ${planLabel} plan charges ${planPrice}. Add a payment method before then to keep access.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  // ── Location count ────────────────────────────────────────────────────────

  if (m(q, 'how many location', 'locations do i have', 'my location', 'number of location', 'locations connected', 'how many restaurant')) {
    const max = ctx.plan === 'starter' ? '1' : ctx.plan === 'growth' ? '5' : '15'
    return {
      text: `You have ${ctx.locationCount} location${ctx.locationCount !== 1 ? 's' : ''} connected. Your ${planLabel} plan supports up to ${max}.`,
    }
  }

  // ── Google connection ─────────────────────────────────────────────────────

  if (m(q, 'is google connected', 'google connected', 'my google status', 'google account status', 'which google location', 'what location am i', 'google location', 'google link', 'am i connected to google')) {
    if (ctx.googleConnected && ctx.googleLocationName) {
      return {
        text: `Yes, Google Business is connected. You're synced to location: ${ctx.googleLocationName}.`,
        link: { label: 'Go to Settings', href: '/dashboard/settings' },
      }
    }
    if (ctx.googleConnected && !ctx.googleLocationName) {
      return {
        text: `Google is authorized but no location has been selected yet. Go to Settings → Google Business to pick your location.`,
        link: { label: 'Select Location', href: '/dashboard/settings' },
      }
    }
    return {
      text: `Google Business is not connected. Go to Settings → Google Business and click "Connect Google" to link your account.`,
      link: { label: 'Connect Google', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'reconnect google', 'reconnect my google', 're-connect', 'token expired', 'google connection expired', 'google disconnected', 'lost google connection')) {
    return {
      text: ctx.googleConnected
        ? `Your Google connection looks active (${ctx.googleLocationName ?? 'location not yet selected'}). If you're seeing an error, click "Reconnect" in Settings to refresh the tokens.`
        : `Google Business is not connected. Go to Settings and click "Connect Google" to link your account.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'sync now', 'sync review', 'force sync', 'manual sync', 'refresh review', 'pull review', 'fetch review', 'update review')) {
    return {
      text: ctx.googleConnected
        ? `Google is connected. Go to Settings and click "Sync now" to pull the latest reviews immediately. Reviews also auto-sync every 6 hours.`
        : `Google Business isn't connected yet. Connect it first before reviews can sync.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'connect google', 'google business', 'link google', 'gmb', 'not connected', 'google my business', 'google account', 'google profile')) {
    return {
      text: ctx.googleConnected
        ? `Google Business is already connected${ctx.googleLocationName ? ` to ${ctx.googleLocationName}` : '. Select a location in Settings to finish setup'}.`
        : `Go to Settings → Google Business and click "Connect Google." Authorize Replova via OAuth, then select your business location. Reviews sync automatically every 6 hours once connected.`,
      link: { label: ctx.googleConnected ? 'Go to Settings' : 'Connect in Settings', href: '/dashboard/settings' },
    }
  }

  // ── Reputation score ──────────────────────────────────────────────────────

  if (m(q, 'how is score calculated', 'score formula', 'score breakdown', 'score meaning', '0 to 100', '0-100', 'what makes up the score', 'score weight', 'score factors')) {
    return {
      text: `The Replova score (0–100) is calculated from: Rating 35% · Response rate 25% · Review volume 20% · Sentiment 20%. Updated daily around 3am.${ctx.reputationScore !== null ? ` Your current score is ${ctx.reputationScore}/100.` : ''}`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'what is my score', 'my current score', 'my reputation score', 'my replova score', 'current score', 'overall score', 'score out of', 'reputation score')) {
    if (ctx.reputationScore !== null) {
      const quality =
        ctx.reputationScore >= 80 ? 'Excellent. You\'re in great shape.'
        : ctx.reputationScore >= 60 ? 'Good. Focus on response rate and getting more reviews to improve.'
        : ctx.reputationScore >= 40 ? 'Fair. Reply to more reviews and run a review request campaign to boost this.'
        : 'Needs attention. Prioritize replying to reviews and requesting more from happy customers.'
      return {
        text: `Your current Replova score is ${ctx.reputationScore}/100. ${quality}`,
        link: { label: 'Go to Dashboard', href: '/dashboard' },
      }
    }
    return {
      text: ctx.plan === 'starter'
        ? `Reputation scores are a Growth/Agency feature. Upgrade to unlock your 0–100 composite score.`
        : `Your score hasn't been calculated yet. It runs daily. Check back tomorrow, or sync your reviews first.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Average rating ────────────────────────────────────────────────────────

  if (m(q, 'my rating', 'my google rating', 'my star rating', 'average rating', 'avg rating', 'what rating', 'what is my rating', 'google rating', 'star average', 'star rating')) {
    if (ctx.avgRating !== null) {
      const stars = '★'.repeat(Math.round(ctx.avgRating)) + '☆'.repeat(5 - Math.round(ctx.avgRating))
      return {
        text: `Your average Google rating is ${ctx.avgRating.toFixed(1)}/5 ${stars} across ${ctx.totalReviews ?? 'your'} review${ctx.totalReviews !== 1 ? 's' : ''}.`,
        link: { label: 'Go to Dashboard', href: '/dashboard' },
      }
    }
    return {
      text: `Your average rating hasn't been calculated yet. Make sure Google Business is connected and reviews have synced.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Review counts ─────────────────────────────────────────────────────────

  if (m(q, 'how many review', 'review count', 'total review', 'number of review', 'review total', 'count of review')) {
    const total = ctx.totalReviews ?? 0
    const awaiting = ctx.awaitingReplyCount
    return {
      text: `You have ${total} total review${total !== 1 ? 's' : ''} , ${awaiting} awaiting a reply${total > awaiting ? `, ${total - awaiting} already replied` : ''}.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'awaiting reply', 'unreplied review', 'reviews to reply', 'need to reply', 'pending reply', 'how many to reply')) {
    const n = ctx.awaitingReplyCount
    return {
      text: n === 0
        ? `All caught up! You have no reviews awaiting a reply.`
        : `You have ${n} review${n !== 1 ? 's' : ''} awaiting a reply. Head to the dashboard to respond.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'reviews this month', 'this month review', 'new reviews this month', "month's review", 'monthly review count', 'reviews in the last')) {
    if (ctx.reviewsThisMonth !== null) {
      return {
        text: `You've received ${ctx.reviewsThisMonth} new review${ctx.reviewsThisMonth !== 1 ? 's' : ''} this month.`,
        link: { label: 'Go to Dashboard', href: '/dashboard' },
      }
    }
    return { text: `Monthly review counts are tracked in the Intelligence Panel once your score data is calculated.` }
  }

  // ── Response rate ─────────────────────────────────────────────────────────

  if (m(q, 'response rate', 'reply rate', 'how many have i replied', 'my response rate', 'what is my response rate', 'how responsive am i', 'how fast do i reply')) {
    const rate = pct(ctx.responseRate)
    if (rate) {
      const comment =
        ctx.responseRate! >= 0.9 ? 'Outstanding. Keep it up!'
        : ctx.responseRate! >= 0.7 ? 'Good. Aim for 90%+ to maximize your score.'
        : ctx.responseRate! >= 0.5 ? 'Moderate. Response rate is 25% of your Replova score. Reply to more reviews to improve.'
        : 'Low. Prioritize replying to reviews. It\'s the quickest way to boost your Replova score.'
      return {
        text: `Your response rate is ${rate}. ${comment}`,
        link: { label: 'Go to Dashboard', href: '/dashboard' },
      }
    }
    return { text: `Response rate data isn't available yet. It appears in the Intelligence Panel once your score has been calculated.` }
  }

  // ── Sentiment ─────────────────────────────────────────────────────────────

  if (m(q, 'my sentiment', 'sentiment score', 'average sentiment', 'overall sentiment', 'what is my sentiment', 'sentiment analysis', 'how positive', 'how negative')) {
    if (ctx.avgSentiment !== null) {
      const label =
        ctx.avgSentiment >= 0.3 ? 'positive'
        : ctx.avgSentiment >= -0.3 ? 'neutral'
        : 'negative'
      const score = Math.round(ctx.avgSentiment * 100)
      return {
        text: `Your average review sentiment is ${label} (${score > 0 ? '+' : ''}${score} out of 100). This is factored into your Replova score.`,
        link: { label: 'Go to Dashboard', href: '/dashboard' },
      }
    }
    return {
      text: ctx.plan === 'starter'
        ? `Sentiment analysis is a Growth/Agency feature. Upgrade to unlock AI-powered sentiment scoring.`
        : `Sentiment data hasn't been calculated yet. It runs nightly. Check back after your first batch.`,
    }
  }

  // ── Auto-reply status ─────────────────────────────────────────────────────

  if (m(q, 'is auto reply on', 'auto reply status', 'is auto reply enabled', 'auto reply on or off', 'is auto-reply', 'auto reply enabled', 'auto reply setting')) {
    return {
      text: ctx.autoReplyEnabled
        ? `Auto-reply is ON. Approved reply drafts are automatically posted to Google after a ${ctx.autoReplyDelayHours}-hour delay.`
        : `Auto-reply is OFF. Enable it in Settings → Reply settings if you want drafts to post automatically.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'auto reply', 'auto-reply', 'automatic reply', 'auto send', 'auto post reply', 'reply delay', 'delay hours', 'auto respond', 'automatically reply', 'automated reply')) {
    return {
      text: ctx.autoReplyEnabled
        ? `Auto-reply is currently ON with a ${ctx.autoReplyDelayHours}-hour delay. Approved drafts post to Google automatically after that window. You can still cancel or edit before it fires.`
        : `Auto-reply is OFF. Enable it in Settings → Reply settings and set your delay (1–24 hours). Approved drafts will then post to Google automatically.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Reply persona ─────────────────────────────────────────────────────────

  if (m(q, 'my persona', 'reply persona', 'my reply style', 'current persona', 'what is my persona', 'what persona', 'persona set', 'voice and tone', 'tone set', 'my voice', 'my tone')) {
    if (ctx.plan !== 'agency') {
      return {
        text: `Custom reply persona is an Agency-only feature. Upgrade to Agency to define exactly how the AI writes your replies.`,
        link: { label: 'Upgrade to Agency', href: '/dashboard/billing' },
      }
    }
    if (ctx.replyPersona) {
      return {
        text: `Your current reply persona: "${ctx.replyPersona}"`,
        link: { label: 'Update Persona', href: '/dashboard/settings' },
      }
    }
    return {
      text: `You're on Agency but no persona is set yet. Add one in Settings → Reply settings to give the AI your specific tone and style.`,
      link: { label: 'Set Persona', href: '/dashboard/settings' },
    }
  }

  // ── Alert settings ────────────────────────────────────────────────────────

  if (m(q, 'are alerts on', 'alerts enabled', 'notifications on', 'am i getting alerts', 'alert status', 'notification status', 'is notification on', 'do i get notified')) {
    return {
      text: ctx.notifyNegativeReviews
        ? `Alerts are ON. You'll receive an email with a suggested reply for any review ${ctx.negativeThreshold} stars or below.`
        : `Alerts are OFF. Enable them in Settings → Reply settings to get instant emails for negative reviews.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'alert threshold', 'my threshold', 'what threshold', 'threshold set', 'which star threshold')) {
    return {
      text: ctx.notifyNegativeReviews
        ? `Your alert threshold is set to ${ctx.negativeThreshold} stars. You get an email for any review rated ${ctx.negativeThreshold}★ or below.`
        : `You don't have alerts enabled. Turn them on in Settings and set a threshold (e.g. 3 stars and below).`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Improve score / best practices ───────────────────────────────────────

  if (m(q, 'improve my score', 'better score', 'increase score', 'boost score', 'score is low', 'how to improve', 'improve reputation', 'better reputation')) {
    const tips: string[] = []
    if (ctx.awaitingReplyCount > 0) tips.push(`Reply to your ${ctx.awaitingReplyCount} unanswered review${ctx.awaitingReplyCount !== 1 ? 's' : ''} (response rate is 25% of the score)`)
    if (ctx.responseRate !== null && ctx.responseRate < 0.8) tips.push(`Your response rate is ${pct(ctx.responseRate)}. Aim for 80%+`)
    tips.push('Send review requests to happy customers to grow your review volume')
    if (ctx.avgRating !== null && ctx.avgRating < 4.5) tips.push('Address negative reviews promptly and professionally')
    return {
      text: `To improve your Replova score${ctx.reputationScore !== null ? ` (currently ${ctx.reputationScore}/100)` : ''}:\n\n${tips.map((t, i) => `${i + 1}) ${t}`).join('\n')}`,
      link: { label: 'Send Review Requests', href: '/dashboard/review-requests' },
    }
  }

  if (m(q, 'get more reviews', 'more google reviews', 'increase reviews', 'grow reviews', 'more reviews', 'ask customers', 'request reviews')) {
    return {
      text: `Use Review Requests to email customers asking for a Google review. You currently have ${ctx.totalReviews ?? 0} reviews. Upload a CSV with name + email, hit "Send All," and track opens and clicks. It's the most effective way to grow your review count.`,
      link: { label: 'Go to Review Requests', href: '/dashboard/review-requests' },
    }
  }

  if (m(q, 'handle negative', 'respond to negative', 'bad review', 'one star', '1 star review', '1-star', 'negative review response', 'how do i deal with')) {
    return {
      text: `For negative reviews: respond within 24 hours, acknowledge the experience, apologize without being defensive, and offer to make it right offline. The Warm or Professional AI draft is usually best. Quick responses show other readers you take feedback seriously.${ctx.awaitingReplyCount > 0 ? ` You currently have ${ctx.awaitingReplyCount} review${ctx.awaitingReplyCount !== 1 ? 's' : ''} awaiting a reply.` : ''}`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Getting started ───────────────────────────────────────────────────────

  if (m(q, 'get started', 'first step', 'getting started', 'set up', 'setup', 'just signed up', 'brand new', 'starting out', 'where do i start', 'how do i start')) {
    const step1 = ctx.googleConnected ? '✓ Google Business connected' : '1) Connect Google Business in Settings'
    const step2 = ctx.googleConnected ? (ctx.awaitingReplyCount > 0 ? `2) Reply to your ${ctx.awaitingReplyCount} awaiting review${ctx.awaitingReplyCount !== 1 ? 's' : ''}` : '2) Reviews will sync automatically') : '2) Sync reviews'
    const step3 = '3) Send review requests to grow your Google rating'
    return {
      text: `${step1}\n${step2}\n${step3}`,
      link: ctx.googleConnected ? { label: 'Go to Dashboard', href: '/dashboard' } : { label: 'Connect Google', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'how does replova work', 'what does replova do', 'explain replova', 'what is replova', 'overview of replova')) {
    return {
      text: `Replova connects to your Google Business Profile, imports your reviews, and generates 3 AI reply drafts per review (Professional, Warm, Brief). You can post replies directly to Google, set up auto-replies, track competitors, send review request campaigns, and get weekly digest emails with action items.`,
    }
  }

  // ── Troubleshooting ───────────────────────────────────────────────────────

  if (m(q, 'google not connect', "can't connect google", 'google error', 'oauth error', 'google failed', 'connection failed', 'google not working', 'trouble connecting')) {
    return {
      text: `If Google won't connect: 1) Sign in with the Google account that owns the Business Profile. 2) Grant all requested permissions during OAuth. 3) Try an incognito window to rule out browser extension issues. 4) Disconnect and reconnect from Settings if it still fails.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'reviews not showing', 'why no reviews', 'reviews not loading', 'reviews disappeared', 'missing reviews', 'reviews not appearing')) {
    return {
      text: ctx.googleConnected
        ? `Google is connected. Click "Sync now" in Settings to force a fresh pull. Reviews auto-sync every 6 hours but a manual sync should fix it immediately.`
        : `Google Business isn't connected, which is why reviews aren't showing. Connect it in Settings → Google Business.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'reply failed', "can't post reply", 'post failed', 'error posting', 'reply not posting', 'reply not working', 'unable to post')) {
    return {
      text: `If a reply fails to post: 1) Check Settings. Google may have disconnected. 2) Click "Reconnect" if you see a warning. 3) Make sure the review isn't already replied to on Google. 4) Try again after reconnecting.${ctx.googleConnected ? '' : ' Note: Google Business is currently disconnected.'}`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'score not updating', 'score wrong', "score hasn't changed", 'score not changing', 'score stuck')) {
    return {
      text: `The score updates once per day around 3am.${ctx.reputationScore !== null ? ` Your current score is ${ctx.reputationScore}/100.` : ''} If it looks wrong, sync your reviews first (Settings → Sync now) then wait for the next daily cycle.`,
    }
  }

  if (m(q, 'something broken', 'not working', 'there is a bug', "it's broken", 'page not loading', 'something went wrong', 'error message')) {
    return {
      text: `Try refreshing the page first. If Google-related, reconnect in Settings. If billing-related, use the Stripe billing portal. For persistent issues, contact Replova support. The email is in the footer of your weekly digest.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Can I... ──────────────────────────────────────────────────────────────

  if (m(q, 'multiple user', 'team member', 'add user', 'share access', 'invite team', 'add staff', 'give access', 'other user', 'team access', 'staff login')) {
    return { text: `Replova is single-user per account, tied to one login email. Multi-user team access isn't available yet.` }
  }

  if (m(q, 'can i export', 'export data', 'download data', 'data export', 'download my data')) {
    return {
      text: ctx.plan === 'starter'
        ? `Data export via PDF report is a Growth/Agency feature. Upgrade to download your monthly report.`
        : `Growth and Agency plans include a downloadable monthly PDF report. Agency users can white-label it. There's no raw CSV export currently.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'can i edit', 'can i change the draft', 'edit the ai', 'modify the reply', 'edit the reply', 'can i modify')) {
    return {
      text: `Yes, click any draft to edit it before posting. You can tweak tone, add specific details, or rewrite entirely. Once happy, click Post reply to publish to Google.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Support / contact ─────────────────────────────────────────────────────

  if (m(q, 'contact support', 'get help', 'talk to someone', 'email support', 'human support', 'customer support', 'help desk', 'support team', 'reach out', 'report a problem')) {
    return {
      text: `For support, contact the Replova team. The support email is in the footer of your weekly digest. For billing issues, the Stripe billing portal is the fastest path.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────

  if (m(q, 'delete account', 'cancel account', 'remove account', 'close account', 'delete my account', 'deactivate')) {
    return {
      text: `To delete your account (${ctx.userEmail}), go to Settings → Danger zone. You'll need to confirm twice. This permanently removes all data for "${ctx.restaurantName}". It can't be undone.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  // ── Sign in / auth ────────────────────────────────────────────────────────

  if (m(q, 'sign in', 'log in', 'login', 'magic link', 'email link', 'password', 'sign out', 'log out', 'logout')) {
    return {
      text: `Replova uses magic link sign-in, no passwords. Enter your email (${ctx.userEmail}) on the sign-in page to get a one-click link. To sign out, click your profile avatar in the sidebar.`,
      link: { label: 'Sign-in page', href: '/signin' },
    }
  }

  // ── PDF report / white label ──────────────────────────────────────────────

  if (m(q, 'monthly report', 'pdf report', 'pdf', 'download report', 'white label', 'white-label', 'report branding', 'report logo', 'branded report')) {
    if (ctx.plan === 'starter') {
      return {
        text: `Monthly PDF reports are a Growth/Agency feature. Upgrade to access downloadable reports with your key metrics.`,
        link: { label: 'Upgrade Plan', href: '/dashboard/billing' },
      }
    }
    if (ctx.plan === 'agency') {
      return {
        text: `As an Agency user, you can set your own logo for white-label reports in Settings → Report branding. Download your monthly report from the dashboard.`,
        link: { label: 'Report Branding', href: '/dashboard/settings' },
      }
    }
    return {
      text: `Your Growth plan includes monthly PDF reports. Download yours from the dashboard. Upgrade to Agency to white-label it with your logo.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Weekly digest ─────────────────────────────────────────────────────────

  if (m(q, 'weekly digest', 'weekly email', 'monday email', 'digest email', 'weekly summary')) {
    return {
      text: `Replova sends a weekly digest every Monday morning with your review summary, AI-generated action items, sentiment trends, and staff shoutouts. It's automatic on all plans. Nothing to set up.`,
    }
  }

  // ── Multi-location ────────────────────────────────────────────────────────

  if (m(q, 'multiple location', 'add location', 'switch location', 'location switcher', 'multi-location', 'another location', 'more location')) {
    const max = ctx.plan === 'starter' ? '1' : ctx.plan === 'growth' ? '5' : '15'
    return {
      text: `You have ${ctx.locationCount} location${ctx.locationCount !== 1 ? 's' : ''} connected (max ${max} on ${planLabel}). Use the location switcher in the sidebar to switch between them.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : undefined,
    }
  }

  // ── Review requests ───────────────────────────────────────────────────────

  if (m(q, 'csv', 'upload contact', 'bulk import', 'drag and drop', 'import customer', 'customer list')) {
    return {
      text: `On the Review Requests page, upload a CSV with name and email columns, drag-and-drop or browse. Then click "Send All" to email your customers asking for a Google review.`,
      link: { label: 'Go to Review Requests', href: '/dashboard/review-requests' },
    }
  }

  if (m(q, 'open rate', 'click rate', 'engagement stat', 'request stat', 'how many opened', 'how many clicked')) {
    return {
      text: `The Review Requests page shows total sent, opened, clicked, and your click-through rate. Each request has a status badge (Pending, Sent, Opened, Clicked).`,
      link: { label: 'Go to Review Requests', href: '/dashboard/review-requests' },
    }
  }

  if (m(q, 'review request', 'ask for review', 'request campaign', 'send review email', 'request a review', 'solicit review')) {
    return {
      text: `Go to Review Requests to send email campaigns asking customers for a Google review. Upload a CSV (name + email), hit "Send All," and track opens and clicks. You currently have ${ctx.totalReviews ?? 0} reviews. This is the best way to grow that number.`,
      link: { label: 'Go to Review Requests', href: '/dashboard/review-requests' },
    }
  }

  // ── Competitors ───────────────────────────────────────────────────────────

  if (m(q, 'auto discover', 'auto-discover', 'find competitors automatically', 'nearby competitor')) {
    return {
      text: `Click "Auto-discover" on the Competitors page to automatically find nearby competitors by business type and location.`,
      link: { label: 'Go to Competitors', href: '/dashboard/competitors' },
    }
  }

  if (m(q, 'remove competitor', 'delete competitor', 'untrack competitor')) {
    return {
      text: `Click the trash icon next to a competitor's name to remove them and free up a slot.`,
      link: { label: 'Go to Competitors', href: '/dashboard/competitors' },
    }
  }

  if (m(q, 'competitor slot', 'competitor limit', 'how many competitor')) {
    const slots = ctx.plan === 'starter' ? '3 total'
      : ctx.plan === 'growth' ? `5 per location (${ctx.locationCount * 5} with your ${ctx.locationCount} location${ctx.locationCount !== 1 ? 's' : ''})`
      : `10 per location (${ctx.locationCount * 10} with your ${ctx.locationCount} location${ctx.locationCount !== 1 ? 's' : ''})`
    return {
      text: `Competitor slots: Starter = 3 total, Growth = 5/location, Agency = 10/location. On ${planLabel}, you get ${slots}.`,
      link: ctx.plan !== 'agency' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : undefined,
    }
  }

  if (m(q, 'competitor', 'add competitor', 'search competitor', 'track competitor', 'compare', 'ranking', 'vs you', 'rating comparison', 'stack up')) {
    return {
      text: ctx.plan === 'starter'
        ? `Competitor tracking is a Growth/Agency feature. Upgrade to search by name, auto-discover nearby competitors, and see a comparison table.`
        : `Search for competitors by name or use Auto-discover. The comparison table shows ratings, review counts, and how you rank against each one.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : { label: 'Go to Competitors', href: '/dashboard/competitors' },
    }
  }

  // ── Intelligence panel ────────────────────────────────────────────────────

  if (m(q, 'staff shoutout', 'staff mention', 'employee mention', 'employee name', 'server mention')) {
    return {
      text: ctx.plan === 'starter'
        ? `Staff shoutouts are a Growth/Agency feature. Upgrade to see which employees customers mention positively in reviews.`
        : `Staff shoutouts in the Intelligence Panel show employee names customers mentioned positively. Extracted daily by AI sentiment analysis.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'intelligence panel', 'keyword cloud', 'keyword', 'sidebar panel', 'menu mention')) {
    return {
      text: ctx.plan === 'starter'
        ? `The Intelligence Panel is a Growth/Agency feature. Upgrade to unlock reputation score, keyword cloud, sentiment trends, and staff shoutouts.`
        : `The Intelligence Panel (dashboard sidebar) shows your Replova score, response rate, sentiment trend, top keywords, staff shoutouts, and a competitor link.`,
      link: ctx.plan === 'starter' ? { label: 'Upgrade Plan', href: '/dashboard/billing' } : { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Reply drafts ──────────────────────────────────────────────────────────

  if (m(q, 'professional', 'warm reply', 'brief reply', 'generate reply', 'edit reply', 'reply tone', 'three reply', '3 draft')) {
    return {
      text: `Each review gets 3 AI reply drafts: Professional (formal and thorough), Warm (friendly and personal), Brief (short and to the point). Click any to edit before posting.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'ai reply', 'reply draft', 'draft reply', 'ai draft', 'ai-generated reply', 'how are drafts')) {
    return {
      text: `Replova generates 3 AI reply drafts per review using Claude AI: Professional, Warm, and Brief. Created automatically when reviews sync.${ctx.awaitingReplyCount > 0 ? ` You have ${ctx.awaitingReplyCount} review${ctx.awaitingReplyCount !== 1 ? 's' : ''} with drafts ready.` : ''}`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'post reply', 'post to google', 'send reply to google', 'publish reply', 'how do i post')) {
    return {
      text: `Click "Post reply" on any draft to publish it directly to Google Business Profile.${ctx.googleConnected ? '' : ' Note: Google Business isn\'t connected yet. Connect it in Settings first.'}`,
      link: ctx.googleConnected ? { label: 'Go to Dashboard', href: '/dashboard' } : { label: 'Connect Google', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'mark replied', 'mark as replied', 'already replied', 'replied directly')) {
    return {
      text: `"Mark replied" marks a review as done in Replova without posting through the app. Use this if you replied directly in Google Business Manager.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Reviews (general) ─────────────────────────────────────────────────────

  if (m(q, 'filter review', 'filter by', 'sort review', 'view by rating', 'view by status', 'urgent review', 'unreplied review')) {
    return {
      text: `Filter reviews by status (awaiting reply, replied), star rating (1–5), and sentiment. Urgent reviews (low-rated and unreplied) appear at the top.${ctx.awaitingReplyCount > 0 ? ` You have ${ctx.awaitingReplyCount} awaiting reply now.` : ''}`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  if (m(q, 'demo mode', 'demo data', 'sample review', 'demo review', 'fake review')) {
    return {
      text: `Demo mode shows sample reviews so you can explore Replova before real reviews sync.${ctx.googleConnected ? ' Your Google is connected. Click "Sync now" in Settings to load your real reviews.' : ' Connect Google Business in Settings to replace demo data with your actual reviews.'}`,
      link: { label: ctx.googleConnected ? 'Go to Settings' : 'Connect Google', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'reply to', 'view review', 'review inbox', 'see review', 'my review', 'google review', 'latest review', 'recent review', 'new review')) {
    return {
      text: `Your review inbox is on the dashboard. You have ${ctx.totalReviews ?? 0} total review${(ctx.totalReviews ?? 0) !== 1 ? 's' : ''}, ${ctx.awaitingReplyCount} awaiting a reply. Click any review to expand it and see your 3 AI reply drafts.`,
      link: { label: 'Go to Dashboard', href: '/dashboard' },
    }
  }

  // ── Billing — plan comparison ─────────────────────────────────────────────

  if (m(q, 'compare plan', 'plan comparison', 'difference between plan', 'which plan should', 'what plan is best', 'plan difference', 'starter vs', 'growth vs')) {
    return {
      text: `Starter ($79): 1 location, AI replies, alerts, digest. Growth ($179): 5 locations + score, sentiment, competitors, PDF. Agency ($349): 15 locations + custom persona, white-label. You're currently on ${planLabel}.`,
      link: { label: 'View Plans', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'starter') && m(q, 'plan', 'include', 'feature', 'what', 'get', 'have', 'offer')) {
    return {
      text: `Starter ($79/mo): 1 location, 3 competitor slots, AI reply drafts (3 tones), urgent review alerts, weekly digest, review request campaigns.${ctx.plan === 'starter' ? ' This is your current plan.' : ''}`,
      link: { label: 'View Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'growth') && m(q, 'plan', 'include', 'feature', 'what', 'get', 'have', 'offer')) {
    return {
      text: `Growth ($179/mo): Everything in Starter + up to 5 locations, 5 competitor slots/location, reputation score, sentiment analysis, competitor tracking, monthly PDF reports.${ctx.plan === 'growth' ? ' This is your current plan.' : ''}`,
      link: { label: 'View Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'agency') && m(q, 'plan', 'include', 'feature', 'what', 'get', 'have', 'offer')) {
    return {
      text: `Agency ($349/mo): Everything in Growth + up to 15 locations, 10 competitor slots/location, custom reply persona, white-label PDF reports.${ctx.plan === 'agency' ? ' This is your current plan.' : ''}`,
      link: { label: 'View Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'cancel subscription', 'cancel my plan', 'unsubscribe', 'cancel billing', 'stop paying')) {
    return {
      text: `Cancel anytime through the Stripe billing portal. Click "Manage subscription" on the Billing page. Access continues until the end of your current billing period${ctx.renewalDate ? ` (${ctx.renewalDate})` : ''}.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'invoice', 'receipt', 'billing history', 'past invoice', 'payment history')) {
    return {
      text: `Invoices and receipts are in the Stripe billing portal. Click "Manage subscription" on the Billing page to view your full payment history.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'upgrade', 'downgrade', 'change plan', 'switch plan')) {
    return {
      text: `Upgrade or downgrade on the Billing page. Click the button on any plan card. Or click "Manage subscription" for the Stripe portal with proration. You're currently on ${planLabel} (${planPrice}).`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'payment method', 'credit card', 'add card', 'update card', 'stripe', 'manage subscription', 'billing portal', 'add payment')) {
    return {
      text: `Update your payment method, change your plan, or view invoices in the Stripe billing portal. Click "Manage subscription" on the Billing page.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  if (m(q, 'billing', 'pricing', 'how much', 'cost', 'price', 'subscription fee', 'monthly fee')) {
    const renewal = ctx.renewalDate ? ` Next charge: ${ctx.renewalDate}.` : ` Trial ends ${ctx.trialEndDate}.`
    return {
      text: `You're on ${planLabel} (${planPrice}).${renewal} Plans: Starter $79 · Growth $179 · Agency $349/mo.`,
      link: { label: 'Go to Billing', href: '/dashboard/billing' },
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  if (m(q, 'setting', 'preferences', 'account setting', 'configuration')) {
    return {
      text: `Settings covers: Google Business connection, auto-reply (currently ${ctx.autoReplyEnabled ? 'ON' : 'OFF'}), notification alerts (${ctx.notifyNegativeReviews ? 'ON' : 'OFF'}), reply persona (Agency only), report branding (Agency only), and account deletion.`,
      link: { label: 'Go to Settings', href: '/dashboard/settings' },
    }
  }

  if (m(q, 'how to get to', 'where is', 'navigate to', 'find the page', 'where do i go', 'how do i navigate')) {
    return {
      text: `Sidebar navigation: Dashboard (home), Settings, Billing, Competitors, Review Requests. The location switcher at the top switches between your ${ctx.locationCount} location${ctx.locationCount !== 1 ? 's' : ''}.`,
    }
  }

  // ── General help ──────────────────────────────────────────────────────────

  if (m(q, 'what can you do', 'what can you help', 'how does this chatbot', 'what do you know', 'what are you')) {
    return {
      text: `I'm the Replova assistant, and I know your account details. Ask me anything: your subscription renewal, Google connection status, your ${ctx.reputationScore !== null ? `${ctx.reputationScore}/100` : ''} reputation score, the ${ctx.awaitingReplyCount} reviews awaiting reply, billing, competitors, settings, anything.`,
    }
  }

  if (m(q, 'help me', 'i need help', "i don't understand", 'confused', 'how do i', 'how does', "what's the", 'tell me about', 'explain', 'help with', 'can you help')) {
    return {
      text: `I can help with anything in Replova. Ask me about: your ${planLabel} plan, Google connection, replying to reviews, your reputation score, billing, competitors, review requests, auto-reply settings, or your account stats.`,
    }
  }

  // Fallback
  return {
    text: `I don't have a specific answer for that. Try asking about your subscription renewal, Google connection, the ${ctx.awaitingReplyCount} reviews awaiting reply, your ${planLabel} plan, or any other Replova feature.`,
  }
}

interface ChatbotProps {
  restaurantName: string
  userEmail: string
  plan: string
  locationCount: number
  trialEndDate: string
  renewalDate: string | null
  subscriptionStatus: string
  googleConnected: boolean
  googleLocationName: string | null
  reputationScore: number | null
  avgRating: number | null
  totalReviews: number | null
  reviewsThisMonth: number | null
  responseRate: number | null
  avgSentiment: number | null
  awaitingReplyCount: number
  autoReplyEnabled: boolean
  autoReplyDelayHours: number
  replyPersona: string | null
  notifyNegativeReviews: boolean
  negativeThreshold: number
}

export default function Chatbot(props: ChatbotProps) {
  const ctx: ChatContext = props

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open])

  function send(text: string) {
    if (!text.trim()) return
    const userMsg: Message = { role: 'user', text: text.trim() }
    const response = getResponse(text, ctx)
    const botMsg: Message = { role: 'bot', text: response.text, link: response.link }
    setMessages(prev => [...prev, userMsg, botMsg])
    setInput('')
  }

  return (
    <>
      <style>{`
        @media (max-width: 440px) {
          .chatbot-panel {
            width: calc(100vw - 24px) !important;
            right: 12px !important;
            left: 12px !important;
            bottom: 76px !important;
          }
        }
        .chatbot-input:focus {
          outline: none;
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 2px var(--accent-sub);
        }
        .chatbot-link-btn:hover {
          background: var(--accent) !important;
          color: #fff !important;
        }
        .chatbot-chip:hover {
          background: var(--surface-3) !important;
          color: var(--t1) !important;
          border-color: var(--border-md) !important;
        }
        .chatbot-msg { white-space: pre-line; }
      `}</style>

      {open && (
        <div
          className="chatbot-panel"
          style={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            width: 360,
            height: 480,
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius-l)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-0)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.2 }}>Replova Assistant</div>
                <div style={{ fontSize: 11, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                  Online
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="btn-press"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 5, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="chatbot-msg" style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: '12px 12px 12px 3px', background: 'var(--surface-2)', color: 'var(--t1)', fontSize: 13, lineHeight: 1.55 }}>
                {`Hi! I'm the Replova assistant for ${ctx.restaurantName}. Ask me anything: your subscription, reviews, Google connection, score, billing, settings, or any feature.`}
              </div>
            </div>

            {messages.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 2 }}>
                {CHIPS.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => send(chip.input)}
                    className="chatbot-chip btn-press"
                    style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--t2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%' }}>
                  <div className="chatbot-msg" style={{ padding: '9px 12px', borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-2)', color: 'var(--t1)', fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>
                  {msg.link && (
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={msg.link.href}
                        className="chatbot-link-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, background: 'var(--accent-sub)', border: '1px solid var(--accent)', color: 'var(--accent-hi)', fontSize: 12, fontWeight: 600, textDecoration: 'none', transition: 'all 0.12s' }}
                      >
                        {msg.link.label}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--surface-0)', flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input) }}
              placeholder="Ask anything…"
              className="chatbot-input"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border-md)', background: 'var(--surface-2)', color: 'var(--t1)', fontSize: 13, fontFamily: 'inherit', transition: 'border-color 0.12s, box-shadow 0.12s' }}
            />
            <button
              onClick={() => send(input)}
              className="btn-press"
              disabled={!input.trim()}
              style={{ padding: '8px 13px', borderRadius: 9, border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--surface-2)', color: input.trim() ? 'white' : 'var(--t3)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-press"
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)' }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        )}
      </button>
    </>
  )
}
