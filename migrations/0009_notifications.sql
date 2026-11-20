-- Which email notifications each person chose, as JSON {event: true|false}.
-- NULL means the defaults in shared/notify.ts.
ALTER TABLE users ADD COLUMN notify TEXT;
