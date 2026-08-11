import { detectionService } from './src/services/detection.service.js';
import { cnnDetector } from './src/algorithms/cnn/detector.js';
import sharp from 'sharp';

async function main() {
  const buf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 10, g: 10, b: 10 } // dark image
    }
  }).jpeg().toBuffer();

  const file: any = {
    buffer: buf,
    mimetype: 'image/jpeg',
    size: buf.length
  };

  // Mock the detector to force a pothole detection
  cnnDetector.detect = async () => ({
    isPothole: true,
    confidence: 0.99,
    boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    severity: 'HIGH',
    classProbs: [0, 0, 0, 0.99, 0]
  });

  try {
    const res = await detectionService.detect(file);
    console.log('Success:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
