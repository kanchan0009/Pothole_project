import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);


export function validateImageFile(file: Express.Multer.File, message?: string): void {
  const invalidMsg =
    message ??
    'The uploaded image is not in a valid format. Please upload a clear image of the pothole.';
  if (!file?.buffer?.length) {
    throw ApiError.badRequest(invalidMsg);
  }
  const mime = (file.mimetype || '').toLowerCase();
  
  if (mime && mime !== 'application/octet-stream' && !ALLOWED_MIMES.has(mime)) {
    throw ApiError.badRequest(invalidMsg);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw ApiError.badRequest(invalidMsg);
  }
}

const AVATAR_INVALID_MSG =
  'Please upload a valid profile photo (JPEG, PNG, or WebP, max 5 MB).';


export async function processAvatarImage(file: Express.Multer.File): Promise<Buffer> {
  validateImageFile(file, AVATAR_INVALID_MSG);
  try {
    return await sharp(file.buffer)
      .rotate()
      .resize({ width: 400, height: 400, fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw ApiError.badRequest(AVATAR_INVALID_MSG);
  }
}


export async function processImage(file: Express.Multer.File): Promise<Buffer> {
  try {
    const s = sharp(file.buffer);
    const stats = await s.stats();
    
    
    const isBlank = stats.channels.every((ch) => ch.stdev < 1.5);
    if (isBlank) {
      throw ApiError.badRequest('The uploaded image is not in a valid format. Please upload a clear image of the pothole.');
    }

    return await sharp(file.buffer)
      .rotate() 
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


export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 999;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}


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
