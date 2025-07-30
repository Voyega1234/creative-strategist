-- CRITICAL DATABASE INDEXES FOR PERFORMANCE
-- Run these in your Supabase SQL Editor to dramatically improve performance

-- 1. MOST CRITICAL: Index for clients-with-product-focus API (was taking 2568ms)
CREATE INDEX IF NOT EXISTS idx_analysisrun_client_product 
ON "AnalysisRun" ("clientName", "productFocus");

-- 2. Index for saved ideas queries (was taking 1527ms)
CREATE INDEX IF NOT EXISTS idx_savedideas_client_product 
ON "savedideas" ("clientname", "productfocus");

-- 3. Index for client ordering (frequently used)
CREATE INDEX IF NOT EXISTS idx_analysisrun_clientname 
ON "AnalysisRun" ("clientName");

-- 4. Index for saved ideas by date (for faster lookups)
CREATE INDEX IF NOT EXISTS idx_savedideas_savedat 
ON "savedideas" ("savedat" DESC);

-- 5. Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_client_product 
ON "idea_feedback" ("client_name", "product_focus");

-- 6. Index for competitor queries
CREATE INDEX IF NOT EXISTS idx_competitor_client 
ON "Competitor" ("client_id");

-- 7. Index for research market data
CREATE INDEX IF NOT EXISTS idx_research_client_product 
ON "ResearchMarketData" ("client_name", "product_focus");

-- EXPECTED PERFORMANCE IMPROVEMENTS:
-- clients-with-product-focus: 2568ms → ~50-200ms (10-50x faster)
-- save-idea API: 1527ms → ~30-100ms (15-50x faster)  
-- configure page: 2101ms → ~300-800ms (3-7x faster)
-- Overall app: Much more responsive

-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Click "SQL Editor"
-- 3. Paste this entire file
-- 4. Click "Run"
-- 5. Refresh your app and see dramatic speed improvements!