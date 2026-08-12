import { cnnDetector, evaluateCnnVerdict } from '../src/algorithms/cnn/detector.js';
import { analyzeRoadScenePixels, SCENE_SAMPLE_SIZE } from '../src/algorithms/roadScene.js';
import { analyzePotholeStructure } from '../src/algorithms/potholeStructure.js';
import { runInference } from '../src/algorithms/cnn/forward.js';
import { CnnModel, INPUT_SIZE } from '../src/algorithms/cnn/model.js';
import { loadCnnWeights } from '../src/algorithms/cnn/weights.js';
import { processImage } from '../src/algorithms/image.js';
import sharp from 'sharp';

async function noisyGray(base: number) {
  const w = 640;
  const h = 480;
  const buf = Buffer.alloc(w * h * 3);
  let s = 99;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, base + Math.round((rnd() - 0.5) * 16)));
    buf[i * 3] = buf[i * 3 + 1] = buf[i * 3 + 2] = v;
  }
  const jpeg = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  return processImage({ buffer: jpeg, mimetype: 'image/jpeg', size: jpeg.length } as Express.Multer.File);
}

async function full(label: string, processed: Buffer) {
  const model = CnnModel.fromJSON(await loadCnnWeights());
  const px32 = new Uint8Array(await sharp(processed).greyscale().resize(32, 32, { fit: 'fill' }).raw().toBuffer());
  const input = new Float32Array(px32.length);
  for (let i = 0; i < input.length; i++) input[i] = (px32[i] ?? 0) / 255;
  const { probs, predictedClass } = runInference(model, input);
  const px64g = new Uint8Array(await sharp(processed).greyscale().resize(64, 64, { fit: 'fill' }).raw().toBuffer());
  const px64rgb = new Uint8Array(await sharp(processed).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer());
  const structure = analyzePotholeStructure(px64g);
  const scene = analyzeRoadScenePixels(px64rgb, SCENE_SAMPLE_SIZE * SCENE_SAMPLE_SIZE);
  const verdict = evaluateCnnVerdict(probs, predictedClass, structure, scene);
  const det = await cnnDetector.detect(processed);
  console.log(label, { scene, structureOk: structure.ok, predictedClass, det: det.isPothole, verdict: verdict.isPothole });
}

async function main() {
  await full('gray wall', await noisyGray(140));
  await full('beige', await noisyGray(195));
  await full('webcam face sim', await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 128, g: 125, b: 122 } },
  }).composite([{
    input: await sharp({ create: { width: 320, height: 400, channels: 3, background: { r: 175, g: 130, b: 105 } } }).png().toBuffer(),
    top: 40, left: 160,
  }]).jpeg({ quality: 92 }).toBuffer().then(async (jpeg) =>
    processImage({ buffer: jpeg, mimetype: 'image/jpeg', size: jpeg.length } as Express.Multer.File)
  ));
}

main();
