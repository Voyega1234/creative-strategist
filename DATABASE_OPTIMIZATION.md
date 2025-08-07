# Database Optimization Recommendations

## Critical Performance Issues & Solutions

### 1. Missing Database Indexes

**Current Problem**: Queries are performing full table scans instead of using indexes.

**Recommended Indexes to Add**:

```sql
-- Clients table indexes
CREATE INDEX idx_analysisrun_clientname ON "Clients" ("clientName");
CREATE INDEX idx_analysisrun_productfocus ON "Clients" ("productFocus");
CREATE INDEX idx_analysisrun_client_product ON "Clients" ("clientName", "productFocus");

-- Competitor table indexes  
CREATE INDEX idx_competitor_analysisrunid ON "Competitor" ("analysisRunId");
CREATE INDEX idx_competitor_name ON "Competitor" ("name");
CREATE INDEX idx_competitor_services ON "Competitor" USING GIN ("services");
CREATE INDEX idx_competitor_analysisrun_name ON "Competitor" ("analysisRunId", "name");

-- ClientProfile table indexes
CREATE INDEX idx_clientprofile_clientname ON "ClientProfile" ("clientName");
CREATE INDEX idx_clientprofile_productfocus ON "ClientProfile" ("productFocus");

-- Research_Market table indexes
CREATE INDEX idx_research_market_client_product ON "Research_Market" ("clientName", "productFocus");

-- Feedback table indexes
CREATE INDEX idx_feedback_client_product ON "Feedback" ("clientName", "productFocus");

-- TopPerformingAds table indexes
CREATE INDEX idx_topperformingads_account ON "TopPerformingAds" ("ad_account_id");
CREATE INDEX idx_topperformingads_roas ON "TopPerformingAds" ("roas" DESC);
```

### 2. Query Optimization Recommendations

**For Client Selection (clients.ts)**:
- Current: Multiple queries + client-side grouping
- **Optimized**: Single query with GROUP BY and JSON aggregation

```sql
-- Instead of client-side grouping, use database aggregation:
SELECT 
  MIN(id) as id,
  "clientName",
  JSON_AGG(
    JSON_BUILD_OBJECT('id', id, 'productFocus', "productFocus")
    ORDER BY "productFocus"
  ) as product_focuses
FROM "Clients" 
GROUP BY "clientName" 
ORDER BY "clientName";
```

**For Competitor Filtering (competitors.ts)**:
- Current: Multiple separate queries for filtering
- **Optimized**: Single query with proper WHERE conditions

```sql
-- Optimized competitor query with better filtering:
SELECT * FROM "Competitor" 
WHERE "analysisRunId" = $1 
  AND ($2 IS NULL OR "services" @> ARRAY[$2]::text[])
  AND NOT ("name" ILIKE '%' || $3 || '%')  -- client name exclusion
ORDER BY "name"
LIMIT $4 OFFSET $5;
```

### 3. Connection Pool Optimization

**Current Issue**: No connection pooling configuration specified.

**Recommended Supabase Client Config**:
```typescript
// In lib/supabase/server.ts - add connection pooling
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-connection-pool-size': '20'
      }
    }
  }
)
```

### 4. Query Batching Opportunities

**Current Issue**: Multiple separate queries that could be batched.

**Optimization**: Combine related queries into single calls where possible:

```typescript
// Instead of multiple calls, use Supabase's batch functionality:
const batchResults = await Promise.all([
  supabase.from('Clients').select('competitor_summary').eq('id', id),
  supabase.from('Competitor').select('*').eq('analysisRunId', id),
  supabase.from('UniqueServices').select('services').eq('analysisRunId', id)
]);
```

### 5. Data Pagination Improvements

**Current**: Basic LIMIT/OFFSET pagination (slow for large datasets)
**Recommended**: Cursor-based pagination for better performance

```typescript
// Instead of OFFSET-based pagination:
const { data } = await supabase
  .from('Competitor')
  .select('*')
  .eq('analysisRunId', id)
  .range(start, end)  // This uses OFFSET internally

// Use cursor-based pagination:
const { data } = await supabase
  .from('Competitor')
  .select('*')
  .eq('analysisRunId', id)
  .gt('id', lastSeenId)  // More efficient for large datasets
  .limit(pageSize)
```

## Implementation Priority

### Phase 1 (Immediate - High Impact)
1. ✅ **Parallel Query Execution** - COMPLETED
2. ✅ **Request-Level Caching** - COMPLETED  
3. ✅ **Dynamic Import Optimization** - COMPLETED

### Phase 2 (Next - Medium Impact)
4. **Database Indexes** - Run the SQL commands above
5. **Query Optimization** - Implement optimized queries
6. **Connection Pooling** - Configure Supabase client

### Phase 3 (Future - Long-term)
7. **Cursor-based Pagination** - Replace OFFSET pagination
8. **Database Query Analysis** - Monitor slow queries
9. **Read Replicas** - For high-traffic scenarios

## Expected Performance Gains

- **Configure Page Load Time**: 60-80% reduction (3-5s → 1-2s)
- **Client Selection**: 70% reduction (2-3s → 0.5-1s)  
- **Database Query Time**: 50% reduction with proper indexing
- **Memory Usage**: 30% reduction with optimized data processing

## Monitoring & Maintenance

1. **Query Performance**: Monitor slow query logs
2. **Cache Hit Rates**: Track cache effectiveness
3. **Database Connections**: Monitor connection pool usage
4. **Memory Usage**: Track client-side cache growth

---

**Note**: The most critical optimizations (parallel queries, caching, dynamic imports) have been implemented. Database indexing should be the next priority for maximum performance gains.