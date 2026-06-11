-- Custom SQL migration file, put your code below! --
-- set_timestamps(): manages the created/updated audit columns.
--   INSERT  -> created defaults to now(); updated defaults to created.
--   UPDATE  -> created is frozen; updated bumps to now() unless caller set it.
-- This is the same function authored in src/sql/triggers.sql (proven by
-- test/triggers.test.ts); kept here so `migrate` installs it.
CREATE OR REPLACE FUNCTION set_timestamps() RETURNS trigger AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.created := COALESCE(NEW.created, now());
    NEW.updated := COALESCE(NEW.updated, NEW.created);
  ELSIF TG_OP='UPDATE' THEN
    NEW.created := OLD.created;
    IF NEW.updated IS NOT DISTINCT FROM OLD.updated THEN NEW.updated := now(); END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Attach the trigger to every base table that carries a `created` column. Every
-- such table in this schema also has `updated`, so the function is safe to bind.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='created'
      AND t.table_type='BASE TABLE'
  LOOP
    -- DROP-then-CREATE so the block is hand-replayable (matches test/triggers.test.ts);
    -- the BASE TABLE filter also keeps it safe if replayed after the views exist.
    EXECUTE format('DROP TRIGGER IF EXISTS set_timestamps ON %I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_timestamps()', r.table_name);
  END LOOP;
END $$;
