import { describe, expect, it } from 'vitest';
import { normalizePhotoFile } from '../../lib/photoFile';

describe('normalizePhotoFile', () => {
  it('accepts empty type from native camera captures as jpeg', () => {
    const raw = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'capture', { type: '' });
    const normalized = normalizePhotoFile(raw);
    expect(normalized).not.toBeNull();
    expect(normalized!.type).toBe('image/jpeg');
  });

  it('maps image/jpg to image/jpeg', () => {
    const raw = new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpg' });
    const normalized = normalizePhotoFile(raw);
    expect(normalized?.type).toBe('image/jpeg');
  });
});
