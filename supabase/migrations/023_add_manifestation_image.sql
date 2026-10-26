BEGIN;

-- Vision image for a manifestation, stored as a downscaled JPEG data URL
-- (resized client-side to <= 1600px). The cap keeps rows from ballooning.
ALTER TABLE public.manifestations
  ADD COLUMN IF NOT EXISTS image TEXT;

ALTER TABLE public.manifestations
  DROP CONSTRAINT IF EXISTS manifestations_image_size;

ALTER TABLE public.manifestations
  ADD CONSTRAINT manifestations_image_size
    CHECK (image IS NULL OR length(image) <= 2000000);

COMMIT;
