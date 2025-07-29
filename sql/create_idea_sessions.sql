-- High-performance idea sessions table with optimized indexes
CREATE TABLE idea_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  product_focus TEXT NOT NULL,
  n8n_response JSONB NOT NULL,
  user_input TEXT,
  selected_template TEXT,
  model_used TEXT,
  session_id TEXT NOT NULL,
  ideas_count INTEGER NOT NULL DEFAULT 0, -- For quick filtering
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

-- Composite index for fastest queries (session_id + created_at)
CREATE INDEX idx_sessions_session_created ON idea_sessions(session_id, created_at DESC);

-- Index for client-based queries
CREATE INDEX idx_sessions_client_focus ON idea_sessions(client_name, product_focus, created_at DESC);

-- Index for cleanup (standard index without predicate)
CREATE INDEX idx_sessions_expires ON idea_sessions(expires_at);

-- Index for counting recent sessions (standard index without predicate)
CREATE INDEX idx_sessions_recent ON idea_sessions(created_at DESC, expires_at);

-- GIN index for JSON searches (if needed)
CREATE INDEX idx_sessions_jsonb ON idea_sessions USING GIN(n8n_response);