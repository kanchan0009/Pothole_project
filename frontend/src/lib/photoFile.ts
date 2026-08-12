const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** MIME types the report form accepts after normalisation. */
export function isAcceptedPhotoMime(type: string): boolean {
  return ACCEPTED.has(normalizeMime(type));
}

function normalizeMime(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === 'image/jpg') return 'image/jpeg';
  if (t && ACCEPTED.has(t)) return t;
  return '';
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return '';
}

/**
 * Device cameras often return `""`, `image/jpg`, or `application/octet-stream`.
 * Normalise so upload and native-camera paths match the upload-file pipeline.
 */
export function normalizePhotoFile(file: File): File | null {
  let type = normalizeMime(file.type) || mimeFromName(file.name);
  // Native camera captures frequently omit type and extension.
  if (!type) type = 'image/jpeg';

  if (!ACCEPTED.has(type)) return null;

  const name = file.name?.trim() || 'photo.jpg';
  if (file.type === type && name) return file;
  return new File([file], name.includes('.') ? name : `${name}.jpg`, { type });
}

/** JPEG file from a canvas — with toDataURL fallback for iOS Safari. */
export async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  name = 'camera-capture.jpg',
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });

  if (blob && blob.size > 0) {
    return new File([blob], name, { type: 'image/jpeg' });
  }

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const fallback = await fetch(dataUrl).then((r) => r.blob());
    if (fallback.size === 0) return null;
    return new File([fallback], name, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
