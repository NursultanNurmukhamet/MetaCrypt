/**
 * Metadata writers — the single place where edited state becomes new file
 * bytes. Each function takes the CURRENT working bytes and returns fresh
 * bytes; callers (the image store) then re-parse so UI state always mirrors
 * what is really inside the file. Pixels are never re-encoded.
 */

import type { ImageFormat, PngTextEntry, XmpProperty } from '@/types/image';
import type { ExifDict } from 'piexifjs';
import { writeExifDict } from './exif';
import { setJpegIptc, setJpegXmp } from './jpeg';
import { getPngTextEntries, setPngTextAndXmp } from './png';
import { serializeIptc, type IptcDataSet } from './iptc';
import { serializeXmp } from './xmp';

/** Write an EXIF dict (JPEG only — enforced by capabilities in the UI). */
export function applyExif(bytes: Uint8Array, format: ImageFormat, dict: ExifDict): Uint8Array {
  if (format !== 'jpeg') throw new Error('EXIF writing is only supported for JPEG');
  return writeExifDict(bytes, dict);
}

/**
 * Write XMP properties. Passing an empty list removes the packet entirely —
 * we never leave a hollow `<rdf:Description/>` shell behind.
 */
export function applyXmp(bytes: Uint8Array, format: ImageFormat, props: XmpProperty[]): Uint8Array {
  const packet = props.length > 0 ? serializeXmp(props) : null;
  if (format === 'jpeg') return setJpegXmp(bytes, packet);
  if (format === 'png') {
    // Preserve the existing text chunks; only the XMP iTXt changes.
    return setPngTextAndXmp(bytes, getPngTextEntries(bytes), packet);
  }
  throw new Error('XMP writing is only supported for JPEG and PNG');
}

/** Write IPTC datasets (JPEG only). Empty list removes the APP13 segment. */
export function applyIptc(bytes: Uint8Array, format: ImageFormat, sets: IptcDataSet[]): Uint8Array {
  if (format !== 'jpeg') throw new Error('IPTC writing is only supported for JPEG');
  return setJpegIptc(bytes, sets.length > 0 ? serializeIptc(sets) : null);
}

/** Write PNG text chunks, preserving the XMP packet as-is. */
export function applyPngText(
  bytes: Uint8Array,
  format: ImageFormat,
  entries: PngTextEntry[],
  currentXmpPacket: string | null,
): Uint8Array {
  if (format !== 'png') throw new Error('PNG text is only supported for PNG');
  return setPngTextAndXmp(bytes, entries, currentXmpPacket);
}
