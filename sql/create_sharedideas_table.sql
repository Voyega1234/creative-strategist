-- Create sharedideas table for shareable URL functionality
-- Run this script in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sharedideas (
    id TEXT PRIMARY KEY,
    clientname TEXT NOT NULL,
    productfocus TEXT NOT NULL,
    instructions TEXT,
    model TEXT DEFAULT 'Gemini 2.5 Pro',
    ideas TEXT NOT NULL, -- JSON string containing all ideas
    createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    totalideas INTEGER DEFAULT 0,
    
    -- Add constraints
    CONSTRAINT sharedideas_id_check CHECK (LENGTH(id) > 0),
    CONSTRAINT sharedideas_clientname_check CHECK (LENGTH(clientname) > 0),
    CONSTRAINT sharedideas_productfocus_check CHECK (LENGTH(productfocus) > 0),
    CONSTRAINT sharedideas_totalideas_check CHECK (totalideas >= 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sharedideas_createdat ON sharedideas(createdat DESC);
CREATE INDEX IF NOT EXISTS idx_sharedideas_clientname ON sharedideas(clientname);
CREATE INDEX IF NOT EXISTS idx_sharedideas_productfocus ON sharedideas(productfocus);

-- Add comments for documentation
COMMENT ON TABLE sharedideas IS 'Stores shared creative ideas for public viewing via shareable URLs';
COMMENT ON COLUMN sharedideas.id IS 'UUID used in shareable URL path';
COMMENT ON COLUMN sharedideas.clientname IS 'Name of the client/brand';
COMMENT ON COLUMN sharedideas.productfocus IS 'Product focus for the ideas';
COMMENT ON COLUMN sharedideas.instructions IS 'Optional instructions used for generation';
COMMENT ON COLUMN sharedideas.model IS 'AI model used for generation';
COMMENT ON COLUMN sharedideas.ideas IS 'JSON string containing array of generated ideas';
COMMENT ON COLUMN sharedideas.createdat IS 'Timestamp when the share was created';
COMMENT ON COLUMN sharedideas.totalideas IS 'Number of ideas in the share';

-- Optional: Enable Row Level Security (RLS) if needed
-- ALTER TABLE sharedideas ENABLE ROW LEVEL SECURITY;

-- Optional: Create policy for public read access (since these are meant to be shareable)
-- CREATE POLICY "Public read access for shared ideas" ON sharedideas
--     FOR SELECT USING (true);

-- Optional: Create policy for insert (if you want to restrict who can create shares)
-- CREATE POLICY "Allow authenticated users to create shares" ON sharedideas
--     FOR INSERT WITH CHECK (true);

-- Sample data for testing (remove in production)
-- INSERT INTO sharedideas (id, clientname, productfocus, model, ideas, totalideas) VALUES 
-- (
--     'sample-uuid-123',
--     'Test Client',
--     'AI Analytics',
--     'Gemini 2.5 Pro',
--     '[{"title":"Test Idea","description":"Test description","category":"Digital","impact":"High","competitiveGap":"Test gap","tags":["test"],"content_pillar":"Innovation","product_focus":"AI Analytics","concept_idea":"Test concept","copywriting":{"headline":"Test headline","sub_headline_1":"Sub 1","sub_headline_2":"Sub 2","bullets":["Point 1","Point 2"],"cta":"Click here"}}]',
--     1
-- );

COMMIT;