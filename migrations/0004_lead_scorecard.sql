-- When the scorecard email for a lead was last handed to the mail provider.
ALTER TABLE leads ADD COLUMN scorecard_sent_at INTEGER;
