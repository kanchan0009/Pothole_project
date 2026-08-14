import sharp from 'sharp';
import type { DetectionBox, DetectionResult, PotholeDetector } from '../algorithms/detector.js';
import { cnnDetector } from '../algorithms/cnn/detector.js';
import { heuristicDetector } from '../algorithms/heuristicDetector.js';
import { processImage, storeImage, validateImageFile } from '../algorithms/image.js';
import { ApiError } from '../utils/ApiError.js';

export interface DetectOutput extends DetectionResult {
  
  previewUrl: string | null;
}


function resolveDetector(): PotholeDetector {
  return process.env.ROADGUARD_DETECTOR === 'heuristic' ? heuristicDetector : cnnDetector;
}


export const detectionService = {
  async detect(file: Express.Multer.File | undefined): Promise<DetectOutput> {
    if (!file) {
      throw ApiError.badRequest('An image is required');
    }
    validateImageFile(file);
    const processed = await processImage(file);
    const { result, annotated } = await this.analyze(processed);
    return {
      ...result,
      previewUrl: annotated ? await storeImage(annotated) : null,
    };
  },

  
  async analyze(
    processed: Buffer
  ): Promise<{ result: DetectionResult; annotated: Buffer | null }> {
    const result = await resolveDetector().detect(processed);
    const annotated = result.boundingBox ? await annotateBox(processed, result.boundingBox) : null;
    return { result, annotated };
  },
};


export async function annotateBox(buffer: Buffer, box: DetectionBox): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const x = Math.round(box.x * width);
  const y = Math.round(box.y * height);
  const w = Math.max(2, Math.round(box.width * width));
  const h = Math.max(2, Math.round(box.height * height));
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
      `fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="6 4" rx="2"/>` +
      `</svg>`
  );
  return sharp(buffer).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
}
