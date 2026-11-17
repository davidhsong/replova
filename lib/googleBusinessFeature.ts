export type GoogleBusinessAvailability = {
  enabled: boolean
  code: 'ready' | 'disabled' | 'approval_required' | 'not_configured'
  message: string
}

export function getGoogleBusinessAvailability(): GoogleBusinessAvailability {
  if (process.env.GOOGLE_BUSINESS_WORKSPACE_INTEGRATION_ENABLED !== 'true') {
    return {
      enabled: false,
      code: 'disabled',
      message: 'Google Business Profile connection is not enabled for this environment.',
    }
  }

  if (process.env.GOOGLE_BUSINESS_API_ACCESS_CONFIRMED !== 'true') {
    return {
      enabled: false,
      code: 'approval_required',
      message: 'Google Business Profile API access and permitted usage have not been confirmed yet.',
    }
  }

  if (
    !process.env.GOOGLE_CLIENT_ID
    || !process.env.GOOGLE_CLIENT_SECRET
    || !process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY
  ) {
    return {
      enabled: false,
      code: 'not_configured',
      message: 'Google Business Profile OAuth is not fully configured.',
    }
  }

  return {
    enabled: true,
    code: 'ready',
    message: 'Google Business Profile connection is available.',
  }
}

export function isGoogleBusinessReviewSyncEnabled(): boolean {
  return getGoogleBusinessAvailability().enabled
    && process.env.GOOGLE_BUSINESS_REVIEW_SYNC_ENABLED === 'true'
}

export function isGoogleBusinessReviewPublishingEnabled(): boolean {
  return getGoogleBusinessAvailability().enabled
    && process.env.GOOGLE_BUSINESS_REVIEW_PUBLISHING_ENABLED === 'true'
}
