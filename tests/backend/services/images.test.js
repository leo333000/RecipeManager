import { describe, expect, it } from 'vitest';
import { decodeImage, MAX_IMAGE_BYTES } from '../../../backend/services/images.js';
import { TINY_JPEG } from '../../helpers/testApp.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');

describe('decodeImage (spec 04 AC-1)', () => {
  it('accepts a JPEG and a PNG', () => {
    expect(decodeImage({ data: TINY_JPEG, mediaType: 'image/jpeg' })).toBeInstanceOf(Buffer);
    expect(decodeImage({ data: PNG, mediaType: 'image/png' })).toBeInstanceOf(Buffer);
  });

  it('rejects other media types', () => {
    expect(() => decodeImage({ data: TINY_JPEG, mediaType: 'image/svg+xml' })).toThrow(/JPEG, PNG/);
    expect(() => decodeImage({ data: TINY_JPEG, mediaType: 'text/html' })).toThrow();
  });

  it('rejects content that does not match the declared type', () => {
    expect(() => decodeImage({ data: PNG, mediaType: 'image/jpeg' })).toThrow(/not a valid image/);
    expect(() => decodeImage({ data: Buffer.from('<script>').toString('base64'), mediaType: 'image/gif' })).toThrow();
  });

  it('rejects empty and oversized images', () => {
    expect(() => decodeImage({ data: '', mediaType: 'image/jpeg' })).toThrow(/empty/);
    const huge = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    huge.set([0xff, 0xd8, 0xff]);
    expect(() => decodeImage({ data: huge.toString('base64'), mediaType: 'image/jpeg' })).toThrow(/4.5 MB/);
  });
});
