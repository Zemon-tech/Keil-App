ALTER TABLE public.motion_pages
ADD COLUMN IF NOT EXISTS title_search tsvector
GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_motion_pages_title_search
ON public.motion_pages USING GIN(title_search);
