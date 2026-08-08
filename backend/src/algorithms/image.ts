import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/** Rejects unsupported types/sizes before any processing happens. */
export function validateImageFile(file: Express.Multer.File): void {
  if (!file || !file.mimetype || !ALLOWED_MIMES.has(file.mimetype.toLowerCase())) {
    throw ApiError.badRequest('The uploaded image is not in a valid format. Please upload a clear image of the pothole.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw ApiError.badRequest('The uploaded image is not in a valid format. Please upload a clear image of the pothole.');
  }
}

/** Normalizes an uploaded image to a compressed WebP buffer (max 1200 px wide) and validates image content. */
export async function processImage(file: Express.Multer.File): Promise<Buffer> {
  try {
    const s = sharp(file.buffer);
    const stats = await s.stats();
    
    // Check if the image is blank / solid color (very low standard deviation across color channels)
    const isBlank = stats.channels.every((ch) => ch.stdev < 1.5);
    if (isBlank) {
      throw ApiError.badRequest('The uploaded image is not in a valid format. Please upload a clear image of the pothole.');
    }

    return await sharp(file.buffer)
      .rotate() // honor EXIF orientation from phone cameras
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('The uploaded image is not in a valid format. Please upload a clear image of the pothole.');
  }
}

export async function computeImageHash(buffer: Buffer): Promise<string> {
  try {
    const raw = await sharp(buffer)
      .grayscale()
      .resize(16, 16, { fit: 'fill' })
      .raw()
      .toBuffer();

    let sum = 0;

    for (let i = 0; i < raw.length; i++) {
      sum += raw[i] ?? 0;
    }

    const avg = sum / raw.length;

    let hashStr = '';

    for (let i = 0; i < raw.length; i++) {
      hashStr += (raw[i] ?? 0) >= avg ? '1' : '0';
    }

    return hashStr;
  } catch {
    return '';
  }
}

/** Computes Hamming distance between two binary hash strings. */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 999;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

/** Uploads a buffer to Cloudinary; falls back to local disk when no creds are set. */
export async function storeImage(buffer: Buffer): Promise<string> {
  const hasCloudinary = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );
  if (hasCloudinary) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    return uploadBufferToCloudinary(buffer);
  }

  // Local-disk fallback: saved under backend/uploads/, served at /uploads/<file>.
  const fileName = `${crypto.randomUUID()}.webp`;
  const dir = path.resolve(process.cwd(), 'uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), buffer);
  return `/uploads/${fileName}`;
}

function uploadBufferToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: env.CLOUDINARY_FOLDER, format: 'webp' },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new ApiError(500, 'Image upload failed'));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
