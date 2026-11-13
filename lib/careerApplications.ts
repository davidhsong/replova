export const CAREER_APPLICATION_STATUSES = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
] as const

export type CareerApplicationStatus = typeof CAREER_APPLICATION_STATUSES[number]

export type CareerApplication = {
  id: string
  role_key: string
  role_title: string
  first_name: string
  last_name: string
  email: string
  profile_url: string | null
  school: string
  program: string | null
  graduation: string
  timezone: string
  availability: string
  requires_sponsorship: boolean
  motivation: string
  role_response: string
  learning_goal: string
  resume_path: string | null
  resume_filename: string | null
  resume_content_type: string | null
  status: CareerApplicationStatus
  reviewer_notes: string
  reviewed_by: string | null
  email_notification_sent: boolean
  email_notification_error: string | null
  created_at: string
  updated_at: string
}

export function isCareerApplicationStatus(value: unknown): value is CareerApplicationStatus {
  return typeof value === 'string' && CAREER_APPLICATION_STATUSES.includes(value as CareerApplicationStatus)
}
