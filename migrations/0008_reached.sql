-- The furthest step a record has got to, so that correcting an earlier answer
-- does not lose the steps already opened by the team.
ALTER TABLE cases ADD COLUMN reached INTEGER NOT NULL DEFAULT 1;
UPDATE cases SET reached = stage;
