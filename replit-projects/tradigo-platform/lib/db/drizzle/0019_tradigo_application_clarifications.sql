-- Applicant clarification requests are private to the applicant and review team.
CREATE TABLE IF NOT EXISTS tradigo_application_clarifications (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  applicant_id text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED',
  response text,
  responded_by text,
  responded_at timestamp with time zone,
  closed_by text,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_application_clarifications_application_idx
  ON tradigo_application_clarifications(application_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_application_clarifications_open_idx
  ON tradigo_application_clarifications(application_id)
  WHERE status = 'SUBMITTED';