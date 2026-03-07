-- Migration v10: Add image_data column to modules table
-- Stores base64-encoded images extracted from DOCX files as JSON array
-- Used by the analysis pipeline to send images to vision-capable LLMs

ALTER TABLE modules ADD COLUMN IF NOT EXISTS image_data TEXT;

COMMENT ON COLUMN modules.image_data IS 'JSON array of {data: base64, mime: string} image objects extracted from the document';
