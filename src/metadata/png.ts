/**
 * PNG textual metadata support: tEXt, zTXt and iTXt chunks.
 *
 * We use `png-chunks-extract` / `png-chunks-encode` for the container work
 * (signature + CRC handling) and implement the three text chunk codecs here:
 *
 *   tEXt  = keyword\0 text                          (Latin-1)
 *   zTXt  = keyword\0 method(0) deflate(text)       (Latin-1, compressed)
 *   iTXt  = keyword\0 cflag cmethod lang\0 tkey\0 text   (UTF-8, opt. deflate)
 *
 * XMP inside PNG is, per Adobe's spec, an iTXt chunk with the keyword
 * "XML:com.adobe.xmp", uncompressed.
 */

import extract, { type PngChunk } from 'png-chunks-extract';
import encode from 'png-chunks-encode';
import pako from 'pako';
import type { PngTextEntry } from '@/types/image';
import { concatBytes, latin1Decode, latin1Encode, readU32BE, utf8 } from '@/utils/binary';

/** Adobe-specified keyword that marks the XMP packet inside iTXt. */
export const XMP_KEYWORD = 'XML:com.adobe.xmp';

const TEXT_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt']);

/** Chunks that affect how pixels are rendered — never removed by the cleaner. */
const RENDER_CRITICAL = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT',
]);

/** Decode a single text chunk into an editable entry. Returns null if broken. */
function decodeTextChunk(chunk: PngChunk): PngTextEntry | null {
  try {
    const data = chunk.data;
    const nul = data.indexOf(0);
    if (nul < 0) return null;
    const keyword = latin1Decode(data.subarray(0, nul));

    if (chunk.name === 'tEXt') {
      return { keyword, text: latin1Decode(data.subarray(nul + 1)), kind: 'tEXt' };
    }
    if (chunk.name === 'zTXt') {
      // 1 byte compression method (only 0 = deflate is defined).
      const inflated = pako.inflate(data.subarray(nul + 2));
      return { keyword, text: latin1Decode(inflated), kind: 'zTXt' };
    }
    // iTXt
    const compressed = data[nul + 1] === 1;
    let p = nul + 3;
    const langEnd = data.indexOf(0, p);
    const languageTag = latin1Decode(data.subarray(p, langEnd));
    p = langEnd + 1;
    const tkeyEnd = data.indexOf(0, p);
    const translatedKeyword = utf8.decode(data.subarray(p, tkeyEnd));
    p = tkeyEnd + 1;
    const raw = data.subarray(p);
    const text = utf8.decode(compressed ? pako.inflate(raw) : raw);
    return { keyword, text, kind: 'iTXt', languageTag, translatedKeyword };
  } catch {
    return null; // tolerate malformed chunks instead of crashing the app
  }
}

/** Encode an entry back into a chunk. zTXt entries are re-compressed. */
function encodeTextChunk(entry: PngTextEntry): PngChunk {
  const keyword = latin1Encode(entry.keyword.slice(0, 79)); // spec: 1–79 bytes

  if (entry.kind === 'tEXt') {
    return { name: 'tEXt', data: concatBytes(keyword, new Uint8Array([0]), latin1Encode(entry.text)) };
  }
  if (entry.kind === 'zTXt') {
    const compressed = pako.deflate(latin1Encode(entry.text));
    return { name: 'zTXt', data: concatBytes(keyword, new Uint8Array([0, 0]), compressed) };
  }
  // iTXt — always written uncompressed (simpler, and required for XMP).
  return {
    name: 'iTXt',
    data: concatBytes(
      keyword,
      new Uint8Array([0, 0, 0]), // \0, compression flag = 0, method = 0
      latin1Encode(entry.languageTag ?? ''),
      new Uint8Array([0]),
      utf8.encode(entry.translatedKeyword ?? ''),
      new Uint8Array([0]),
      utf8.encode(entry.text),
    ),
  };
}

/** Read all textual entries (excluding the XMP packet, listed separately). */
export function getPngTextEntries(bytes: Uint8Array): PngTextEntry[] {
  const entries: PngTextEntry[] = [];
  for (const chunk of extract(bytes)) {
    if (!TEXT_CHUNKS.has(chunk.name)) continue;
    const entry = decodeTextChunk(chunk);
    if (entry && entry.keyword !== XMP_KEYWORD) entries.push(entry);
  }
  return entries;
}

/** Read the raw XMP packet from its dedicated iTXt chunk, if present. */
export function getPngXmp(bytes: Uint8Array): string | null {
  for (const chunk of extract(bytes)) {
    if (chunk.name !== 'iTXt') continue;
    const entry = decodeTextChunk(chunk);
    if (entry?.keyword === XMP_KEYWORD) return entry.text;
  }
  return null;
}

/**
 * Rewrite the PNG with a new set of text entries and/or XMP packet.
 * Non-text chunks (pixels, palette, ICC…) are passed through untouched.
 * Text chunks are placed right before IEND — valid per spec, and it keeps
 * the pixel data stream byte-identical.
 */
export function setPngTextAndXmp(
  bytes: Uint8Array,
  entries: PngTextEntry[],
  xmpPacket: string | null,
): Uint8Array {
  const kept = extract(bytes).filter((c) => !TEXT_CHUNKS.has(c.name));
  const iend = kept.pop(); // IEND is always last
  if (!iend || iend.name !== 'IEND') throw new Error('PNG missing IEND chunk');

  const textChunks = entries.map(encodeTextChunk);
  if (xmpPacket !== null) {
    textChunks.push(
      encodeTextChunk({ keyword: XMP_KEYWORD, text: xmpPacket, kind: 'iTXt', languageTag: '', translatedKeyword: '' }),
    );
  }
  return encode([...kept, ...textChunks, iend]);
}

export interface PngCleanOptions {
  /** Remove tEXt/zTXt/iTXt (except the XMP packet — controlled separately). */
  text: boolean;
  /** Remove the XMP iTXt packet. */
  xmp: boolean;
  /** Remove the eXIf chunk. */
  exif: boolean;
  /** Remove the embedded ICC profile (iCCP). */
  icc: boolean;
  /** Remove remaining non-render-critical chunks (tIME, hIST, sPLT…). */
  other: boolean;
}

/** Strip selected metadata chunk families from a PNG. */
export function stripPng(bytes: Uint8Array, opts: PngCleanOptions): Uint8Array {
  const kept = extract(bytes).filter((chunk) => {
    if (TEXT_CHUNKS.has(chunk.name)) {
      const isXmp = chunk.name === 'iTXt' && decodeTextChunk(chunk)?.keyword === XMP_KEYWORD;
      return isXmp ? !opts.xmp : !opts.text;
    }
    if (chunk.name === 'eXIf') return !opts.exif;
    if (chunk.name === 'iCCP') return !opts.icc;
    if (!RENDER_CRITICAL.has(chunk.name)) return !opts.other;
    return true;
  });
  return encode(kept);
}

/** Summary of which metadata families exist in this PNG. */
export function summarizePng(bytes: Uint8Array): {
  hasText: boolean;
  hasXmp: boolean;
  hasExif: boolean;
  hasIcc: boolean;
} {
  let hasText = false;
  let hasXmp = false;
  let hasExif = false;
  let hasIcc = false;
  try {
    for (const chunk of extract(bytes)) {
      if (chunk.name === 'eXIf') hasExif = true;
      else if (chunk.name === 'iCCP') hasIcc = true;
      else if (TEXT_CHUNKS.has(chunk.name)) {
        const entry = decodeTextChunk(chunk);
        if (entry?.keyword === XMP_KEYWORD) hasXmp = true;
        else hasText = true;
      }
    }
  } catch {
    /* malformed PNG — report nothing */
  }
  return { hasText, hasXmp, hasExif, hasIcc };
}

/** Pixel dimensions straight from the IHDR chunk (bytes 16..24 of the file). */
export function getPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}
