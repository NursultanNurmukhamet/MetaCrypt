/**
 * Low-level JPEG segment surgery.
 *
 * A JPEG file is: SOI marker → a list of segments → entropy-coded image data.
 * All metadata (EXIF, XMP, IPTC, ICC, comments) lives in segments BEFORE the
 * image data, which means we can add/replace/remove metadata by splicing
 * segments — the compressed pixels are copied verbatim, byte for byte.
 * That is how MetaCrypt guarantees "never modify pixels, never re-encode".
 */

import { concatBytes, latin1Decode, readU16BE, utf8 } from '@/utils/binary';

/** Marker bytes we care about. */
const SOI = 0xd8; // start of image
const SOS = 0xda; // start of scan — entropy-coded data follows
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP13 = 0xed;
const COM = 0xfe;

/** Signatures that identify what an APPn segment actually contains. */
const SIG_EXIF = 'Exif\0\0';
const SIG_XMP = 'http://ns.adobe.com/xap/1.0/\0';
const SIG_XMP_EXT = 'http://ns.adobe.com/xmp/extension/\0';
const SIG_ICC = 'ICC_PROFILE\0';
const SIG_PHOTOSHOP = 'Photoshop 3.0\0';

/** Max payload of one segment: 65535 minus the 2 length bytes. */
const MAX_SEGMENT_PAYLOAD = 65_533;

export interface JpegSegment {
  /** Second marker byte (0xE1 for APP1, …). */
  marker: number;
  /** Payload without the FF-marker and length bytes. */
  data: Uint8Array;
}

export interface ParsedJpeg {
  /** Metadata segments between SOI and SOS, in file order. */
  segments: JpegSegment[];
  /** Everything from the SOS marker to EOF — pixels, copied untouched. */
  scanData: Uint8Array;
}

/** What kind of metadata a given segment holds (for filtering/cleaning). */
export type SegmentKind = 'exif' | 'xmp' | 'xmpExtended' | 'icc' | 'iptc' | 'comment' | 'jfif' | 'other';

/** Classify a segment by marker + payload signature. */
export function classifySegment(seg: JpegSegment): SegmentKind {
  const head = latin1Decode(seg.data.subarray(0, 36));
  if (seg.marker === APP1 && head.startsWith(SIG_EXIF)) return 'exif';
  if (seg.marker === APP1 && head.startsWith(SIG_XMP)) return 'xmp';
  if (seg.marker === APP1 && head.startsWith(SIG_XMP_EXT)) return 'xmpExtended';
  if (seg.marker === APP2 && head.startsWith(SIG_ICC)) return 'icc';
  if (seg.marker === APP13 && head.startsWith(SIG_PHOTOSHOP)) return 'iptc';
  if (seg.marker === COM) return 'comment';
  if (seg.marker === APP0) return 'jfif';
  return 'other';
}

/** Parse a JPEG into segments + untouched scan data. Throws on malformed files. */
export function parseJpeg(bytes: Uint8Array): ParsedJpeg {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) throw new Error('Not a JPEG file');
  const segments: JpegSegment[] = [];
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Corrupted JPEG segment stream');
    const marker = bytes[offset + 1];

    // SOS: from here on it's entropy-coded data — stop parsing, copy the rest.
    if (marker === SOS) {
      return { segments, scanData: bytes.subarray(offset) };
    }
    // Standalone markers (no payload) — rare before SOS, but be tolerant.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = readU16BE(bytes, offset + 2); // includes the 2 length bytes
    const data = bytes.subarray(offset + 4, offset + 2 + length);
    segments.push({ marker, data });
    offset += 2 + length;
  }
  throw new Error('JPEG has no image data (missing SOS marker)');
}

/** Serialize segments + scan data back into a complete JPEG file. */
export function buildJpeg(parsed: ParsedJpeg): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0xff, SOI])];
  for (const seg of parsed.segments) {
    const length = seg.data.length + 2;
    if (length > 0xffff) throw new Error('Segment payload exceeds JPEG limit');
    parts.push(new Uint8Array([0xff, seg.marker, (length >> 8) & 0xff, length & 0xff]), seg.data);
  }
  parts.push(parsed.scanData);
  return concatBytes(...parts);
}

/** Extract the raw XMP packet (UTF-8 XML) from a JPEG, if present. */
export function getJpegXmp(bytes: Uint8Array): string | null {
  const { segments } = parseJpeg(bytes);
  const seg = segments.find((s) => classifySegment(s) === 'xmp');
  if (!seg) return null;
  return utf8.decode(seg.data.subarray(SIG_XMP.length));
}

/**
 * Replace / insert / remove the XMP packet.
 * `packet === null` removes XMP entirely. Extended-XMP segments are always
 * dropped on write because they would no longer match the new main packet.
 */
export function setJpegXmp(bytes: Uint8Array, packet: string | null): Uint8Array {
  const parsed = parseJpeg(bytes);
  const kept = parsed.segments.filter((s) => {
    const kind = classifySegment(s);
    return kind !== 'xmp' && kind !== 'xmpExtended';
  });

  if (packet !== null) {
    const payload = concatBytes(utf8.encode(SIG_XMP), utf8.encode(packet));
    if (payload.length > MAX_SEGMENT_PAYLOAD) {
      // Extended-XMP (multi-segment) is out of scope for v1 — fail loudly
      // rather than writing a corrupt file.
      throw new Error('xmp-too-large');
    }
    // Spec-friendly position: right after the leading APP0/APP1 (JFIF/EXIF) block.
    let insertAt = 0;
    while (
      insertAt < kept.length &&
      (kept[insertAt].marker === APP0 || classifySegment(kept[insertAt]) === 'exif')
    ) {
      insertAt++;
    }
    kept.splice(insertAt, 0, { marker: APP1, data: payload });
  }

  return buildJpeg({ segments: kept, scanData: parsed.scanData });
}

/** Extract the raw IPTC-IIM block from the Photoshop APP13 segment. */
export function getJpegIptc(bytes: Uint8Array): Uint8Array | null {
  const { segments } = parseJpeg(bytes);
  const seg = segments.find((s) => classifySegment(s) === 'iptc');
  if (!seg) return null;

  // APP13 payload = "Photoshop 3.0\0" + sequence of 8BIM Image Resource Blocks.
  let off = SIG_PHOTOSHOP.length;
  const data = seg.data;
  while (off + 12 <= data.length) {
    if (latin1Decode(data.subarray(off, off + 4)) !== '8BIM') break;
    const resourceId = readU16BE(data, off + 4);
    // Pascal-style name: 1 length byte + name, padded to even length.
    const nameLen = data[off + 6];
    let p = off + 7 + nameLen;
    if ((nameLen + 1) % 2 === 1) p++;
    const size = ((data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3]) >>> 0;
    p += 4;
    if (resourceId === 0x0404) return data.subarray(p, p + size); // IPTC-NAA record
    off = p + size + (size % 2); // resources are padded to even size
  }
  return null;
}

/** Write (or remove, with `null`) the IPTC-IIM block as a fresh APP13 segment. */
export function setJpegIptc(bytes: Uint8Array, iim: Uint8Array | null): Uint8Array {
  const parsed = parseJpeg(bytes);
  const kept = parsed.segments.filter((s) => classifySegment(s) !== 'iptc');

  if (iim !== null) {
    // Build: signature + one 8BIM resource (id 0x0404, empty name, padded).
    const header = new Uint8Array(SIG_PHOTOSHOP.length + 4 + 2 + 2 + 4);
    const enc = utf8.encode(SIG_PHOTOSHOP);
    header.set(enc, 0);
    let p = enc.length;
    header.set(utf8.encode('8BIM'), p);
    p += 4;
    header[p++] = 0x04; header[p++] = 0x04;      // resource id 0x0404
    header[p++] = 0x00; header[p++] = 0x00;      // empty Pascal name, padded
    header[p++] = (iim.length >>> 24) & 0xff;    // resource size (u32 BE)
    header[p++] = (iim.length >>> 16) & 0xff;
    header[p++] = (iim.length >>> 8) & 0xff;
    header[p++] = iim.length & 0xff;
    const pad = iim.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array(0);
    const payload = concatBytes(header, iim, pad);
    if (payload.length > MAX_SEGMENT_PAYLOAD) throw new Error('iptc-too-large');

    // Position: after leading APP0/APP1 segments, like other writers do.
    let insertAt = 0;
    while (
      insertAt < kept.length &&
      (kept[insertAt].marker === APP0 || kept[insertAt].marker === APP1 || kept[insertAt].marker === APP2)
    ) {
      insertAt++;
    }
    kept.splice(insertAt, 0, { marker: APP13, data: payload });
  }

  return buildJpeg({ segments: kept, scanData: parsed.scanData });
}

/** Which metadata families exist in this JPEG (for the Overview summary). */
export function summarizeJpegSegments(bytes: Uint8Array): Set<SegmentKind> {
  const kinds = new Set<SegmentKind>();
  try {
    for (const seg of parseJpeg(bytes).segments) kinds.add(classifySegment(seg));
  } catch {
    /* unparseable — report nothing rather than crash the UI */
  }
  return kinds;
}

export interface JpegCleanOptions {
  exif: boolean;
  xmp: boolean;
  iptc: boolean;
  icc: boolean;
  comments: boolean;
}

/** Remove selected metadata families. Pixels are never touched. */
export function stripJpeg(bytes: Uint8Array, opts: JpegCleanOptions): Uint8Array {
  const parsed = parseJpeg(bytes);
  const kept = parsed.segments.filter((seg) => {
    switch (classifySegment(seg)) {
      case 'exif': return !opts.exif;
      case 'xmp':
      case 'xmpExtended': return !opts.xmp;
      case 'iptc': return !opts.iptc;
      case 'icc': return !opts.icc;
      case 'comment': return !opts.comments;
      default: return true; // JFIF header, quantization tables, etc. stay
    }
  });
  return buildJpeg({ segments: kept, scanData: parsed.scanData });
}

/** Read pixel dimensions from the SOF segment (no decoding needed). */
export function getJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  try {
    let offset = 2;
    while (offset < bytes.length - 4) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      // SOF0–SOF15 (excluding DHT/JPG/DAC which share the range).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: readU16BE(bytes, offset + 5), width: readU16BE(bytes, offset + 7) };
      }
      if (marker === SOS) return null;
      offset += 2 + readU16BE(bytes, offset + 2);
    }
  } catch {
    /* fall through */
  }
  return null;
}
