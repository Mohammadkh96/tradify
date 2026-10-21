ALTER TABLE tradigo_learning_records
  ADD COLUMN IF NOT EXISTS shared_artifact text,
  ADD COLUMN IF NOT EXISTS unresolved_questions text,
  ADD COLUMN IF NOT EXISTS trader_reflection text;