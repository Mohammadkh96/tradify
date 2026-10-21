-- Versioned assessment authoring and immutable answer snapshots.
CREATE TABLE IF NOT EXISTS tradigo_assessment_questions (
  id text PRIMARY KEY,
  type text NOT NULL,
  version text NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  explanation text,
  status text NOT NULL DEFAULT 'DRAFT',
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_assessment_questions_type_status_idx
  ON tradigo_assessment_questions(type, status, updated_at);

ALTER TABLE tradigo_assessment_answers
  ADD COLUMN IF NOT EXISTS question_version text,
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS options jsonb;