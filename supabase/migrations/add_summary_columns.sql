-- Add summary columns to sections and bills tables

ALTER TABLE sections ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS summary TEXT;
