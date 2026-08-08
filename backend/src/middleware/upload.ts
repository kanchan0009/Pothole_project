import multer from 'multer';

/**
 * Accepts a single image field via multipart/form-data.
 * - Buffers in memory (never touches disk) so the pipeline can validate/compress first.
 * - Size is capped by Multer (returns a clean 413 via the error middleware);
 *   mime-type is checked in the service so we can give a friendly 400.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
