CREATE TABLE SavedIdeas (
  id TEXT PRIMARY KEY,
  clientName TEXT NOT NULL,
  productFocus TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  impact TEXT, -- High, Medium, Low
  competitiveGap TEXT,
  tags TEXT, -- JSON array as string
  content_pillar TEXT,
  product_focus TEXT,
  concept_idea TEXT,
  copywriting_headline TEXT,
  copywriting_sub_headline_1 TEXT,
  copywriting_sub_headline_2 TEXT,
  copywriting_bullets TEXT, -- JSON array as string
  copywriting_cta TEXT,
  savedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  userId TEXT, -- For future user management if needed
  UNIQUE(clientName, productFocus, title) -- Prevent duplicate saves
);