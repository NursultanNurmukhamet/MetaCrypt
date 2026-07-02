/**
 * Metadata Cleaner — strips selected metadata families without touching a
 * single pixel. JPEG: segments are filtered; PNG: chunks are filtered.
 * The output is always a fully valid image.
 */

import type { ImageFormat } from '@/types/image';
import { stripJpeg } from './jpeg';
import { stripPng } from './png';

export interface CleanOptions {
  exif: boolean;
  xmp: boolean;
  iptc: boolean;
  pngText: boolean;
  comments: boolean;
  /** ICC profiles subtly affect rendering — off by default, on for "everything". */
  icc: boolean;
}

export const CLEAN_EVERYTHING: CleanOptions = {
  exif: true,
  xmp: true,
  iptc: true,
  pngText: true,
  comments: true,
  icc: true,
};

export const CLEAN_NOTHING: CleanOptions = {
  exif: false,
  xmp: false,
  iptc: false,
  pngText: false,
  comments: false,
  icc: false,
};

/** Apply the selected cleaning to the current bytes. */
export function cleanImage(bytes: Uint8Array, format: ImageFormat, opts: CleanOptions): Uint8Array {
  if (format === 'jpeg') {
    return stripJpeg(bytes, {
      exif: opts.exif,
      xmp: opts.xmp,
      iptc: opts.iptc,
      icc: opts.icc,
      comments: opts.comments,
    });
  }
  if (format === 'png') {
    return stripPng(bytes, {
      text: opts.pngText,
      xmp: opts.xmp,
      exif: opts.exif,
      icc: opts.icc,
      // tIME and other ancillary metadata ride along with "comments".
      other: opts.comments,
    });
  }
  throw new Error('Cleaning is only supported for JPEG and PNG');
}
