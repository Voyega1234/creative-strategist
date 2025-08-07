-- Add related_news_ids column to Clients table
-- This column will store an array of news article IDs that are related to each client/product focus

ALTER TABLE "Clients" 
ADD COLUMN IF NOT EXISTS "related_news_ids" TEXT[] DEFAULT '{}';

-- Add an index for better performance when querying related news
CREATE INDEX IF NOT EXISTS "idx_analysis_run_related_news" 
ON "Clients" ("clientName", "productFocus") 
WHERE "related_news_ids" IS NOT NULL AND array_length("related_news_ids", 1) > 0;

-- Add a comment to document the column
COMMENT ON COLUMN "Clients"."related_news_ids" IS 'Array of news article IDs that are related to this client/product focus combination';