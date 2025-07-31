-- SAFE DATABASE INDEXES FOR PERFORMANCE
-- These are the most critical indexes with verified column names
-- Run these first, then add others as needed

-- 1. MOST CRITICAL: Index for AnalysisRun queries (clients-with-product-focus API)
CREATE INDEX IF NOT EXISTS idx_analysisrun_client_product 
ON "AnalysisRun" ("clientName", "productFocus");

-- 2. Index for AnalysisRun client ordering (frequently used)
CREATE INDEX IF NOT EXISTS idx_analysisrun_clientname 
ON "AnalysisRun" ("clientName");

-- 3. Index for savedideas queries (save-idea API)
CREATE INDEX IF NOT EXISTS idx_savedideas_client_product 
ON "savedideas" ("clientname", "productfocus");

-- 4. Index for savedideas by date (for faster lookups)
CREATE INDEX IF NOT EXISTS idx_savedideas_savedat 
ON "savedideas" ("savedat" DESC);

-- 5. Index for competitor queries (verified column name)
CREATE INDEX IF NOT EXISTS idx_competitor_analysisrun 
ON "Competitor" ("analysisRunId");

-- Test these first, then run the additional ones below if tables exist:

-- ADDITIONAL INDEXES (run only if tables exist):
-- For feedback queries:
-- CREATE INDEX IF NOT EXISTS idx_feedback_client_product 
-- ON "idea_feedback" ("client_name", "product_focus");

-- For research market data:
-- CREATE INDEX IF NOT EXISTS idx_research_client_product 
-- ON "ResearchMarketData" ("client_name", "product_focus");

-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste the indexes above (the first 5)
-- 3. Click "Run"
-- 4. If successful, try the additional ones in the comments

-- EXPECTED IMPROVEMENTS:
-- clients-with-product-focus: 2568ms → ~50-200ms
-- save-idea API: 1527ms → ~30-100ms  
-- configure page: 2101ms → ~300-800ms

-- ADDITIONAL CRITICAL INDEXES for save-idea API optimization:
-- For save-idea title lookups (currently taking 276-296ms):
CREATE INDEX IF NOT EXISTS idx_savedideas_title_lookup 
ON "savedideas" ("clientname", "productfocus", "title");

-- For faster savedideas queries by date:
CREATE INDEX IF NOT EXISTS idx_savedideas_date_optimized 
ON "savedideas" ("savedat" DESC, "clientname", "productfocus");

-- Composite index for all common savedideas operations:
CREATE INDEX IF NOT EXISTS idx_savedideas_composite 
ON "savedideas" ("clientname", "productfocus", "savedat" DESC);