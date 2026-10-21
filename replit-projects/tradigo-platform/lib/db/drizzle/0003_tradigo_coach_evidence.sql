-- Coach application evidence is additive and safe to apply to existing databases.
CREATE TABLE IF NOT EXISTS tradigo_coach_applications (
  id text PRIMARY KEY,
  applicant_id text NOT NULL,
  applicant_name text,
  applicant_email text,
  status text NOT NULL DEFAULT 'DRAFT',
  current_step integer NOT NULL DEFAULT 1,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  markets jsonb NOT NULL DEFAULT '{}'::jsonb,
  experience jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_note text,
  submitted_at timestamp with time zone,
  decided_at timestamp with time zone,
  decided_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_coach_applications_applicant_idx ON tradigo_coach_applications(applicant_id);
CREATE INDEX IF NOT EXISTS tradigo_coach_applications_status_idx ON tradigo_coach_applications(status, updated_at);

CREATE TABLE IF NOT EXISTS tradigo_assessment_attempts (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  applicant_id text NOT NULL,
  type text NOT NULL,
  version text NOT NULL,
  status text NOT NULL,
  score integer NOT NULL,
  max_score integer NOT NULL,
  attempt_number integer NOT NULL,
  answers_reviewed integer NOT NULL,
  reviewer_note text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_assessment_attempts_application_type_attempt_idx
  ON tradigo_assessment_attempts(application_id, type, attempt_number);
CREATE INDEX IF NOT EXISTS tradigo_assessment_attempts_application_idx
  ON tradigo_assessment_attempts(application_id, submitted_at);

CREATE TABLE IF NOT EXISTS tradigo_assessment_answers (
  id text PRIMARY KEY,
  attempt_id text NOT NULL,
  question_id text NOT NULL,
  answer text NOT NULL,
  is_correct text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_assessment_answers_attempt_question_idx
  ON tradigo_assessment_answers(attempt_id, question_id);

CREATE TABLE IF NOT EXISTS tradigo_application_documents (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  applicant_id text NOT NULL,
  document_type text NOT NULL,
  name text NOT NULL,
  description text,
  issuer text,
  object_path text,
  mime_type text,
  size_bytes integer,
  status text NOT NULL DEFAULT 'RECEIVED',
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_application_documents_application_idx
  ON tradigo_application_documents(application_id, submitted_at);

CREATE TABLE IF NOT EXISTS tradigo_application_audit (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_application_audit_application_idx
  ON tradigo_application_audit(application_id, created_at);