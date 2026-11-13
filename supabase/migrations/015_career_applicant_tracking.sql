-- Store website career applications and private resume uploads so recruiting
-- does not depend on third-party job-board application limits.
CREATE TABLE IF NOT EXISTS career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  role_title text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  profile_url text,
  school text NOT NULL,
  program text,
  graduation text NOT NULL,
  timezone text NOT NULL,
  availability text NOT NULL,
  requires_sponsorship boolean NOT NULL DEFAULT false,
  motivation text NOT NULL,
  role_response text NOT NULL,
  learning_goal text NOT NULL,
  resume_path text,
  resume_filename text,
  resume_content_type text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected')),
  reviewer_notes text NOT NULL DEFAULT '',
  reviewed_by text,
  email_notification_sent boolean NOT NULL DEFAULT false,
  email_notification_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_applications_created_at_idx
  ON career_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS career_applications_status_idx
  ON career_applications (status);
CREATE INDEX IF NOT EXISTS career_applications_role_key_idx
  ON career_applications (role_key);
CREATE INDEX IF NOT EXISTS career_applications_email_idx
  ON career_applications (lower(email));

ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;

-- The application and recruiting API routes use the service role after their
-- own validation/auth checks. No browser-facing RLS policies are intentional.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'career-resumes',
  'career-resumes',
  false,
  4194304,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
