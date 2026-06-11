CREATE OR REPLACE FUNCTION set_timestamps() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created := COALESCE(NEW.created, now());
    NEW.updated := COALESCE(NEW.updated, NEW.created);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created := OLD.created; -- never changes
    IF NEW.updated IS NOT DISTINCT FROM OLD.updated THEN
      NEW.updated := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
