/**
 * EXIF editing for JPEG files, built on piexifjs.
 *
 * piexifjs works with "binary strings" and nested IFD dictionaries; this
 * module hides that behind a simple API: read entries → edit as strings →
 * write back. Values are serialized/parsed according to the official tag
 * type (Ascii, Short, Rational, …) so edited files stay spec-compliant.
 */

import piexif, { type ExifDict, type IfdName, type TagSpec } from 'piexifjs';
import type { MetaEntry } from '@/types/image';
import { binaryStringToBytes, bytesToBinaryString } from '@/utils/binary';

/** piexif keeps tag specs under spec-group names; loaded dicts use IFD names. */
const IFD_TO_GROUP: Record<IfdName, 'Image' | 'Exif' | 'GPS' | 'Interop'> = {
  '0th': 'Image',
  '1st': 'Image',
  Exif: 'Exif',
  GPS: 'GPS',
  Interop: 'Interop',
};

const IFD_ORDER: IfdName[] = ['0th', 'Exif', 'GPS', 'Interop', '1st'];

function tagSpec(ifd: IfdName, tag: number): TagSpec | undefined {
  return piexif.TAGS[IFD_TO_GROUP[ifd]]?.[tag];
}

/** A rational is stored as [numerator, denominator]. */
type Rational = [number, number];

/** Render any piexif value as an editable string. */
function valueToString(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\0+$/, ''); // strip NUL padding
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    // Rational: [n, d]; array of rationals: [[n,d], ...]; plain number arrays.
    if (value.length === 2 && value.every((v) => typeof v === 'number') && looksLikeRational(value as number[])) {
      return `${value[0]}/${value[1]}`;
    }
    return value
      .map((v) => (Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v)))
      .join(', ');
  }
  return String(value);
}

/**
 * Heuristic: piexif gives both "two shorts" and "one rational" as [a, b].
 * We only format as a fraction when the tag type says Rational — this helper
 * is a fallback for untyped tags where a fraction is the safer guess.
 */
function looksLikeRational(v: number[]): boolean {
  return v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[1] !== 0;
}

/** Parse "n/d" or a decimal ("2.5" → 5/2) into a piexif rational. */
function parseRational(s: string): Rational {
  const frac = s.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) return [Number(frac[1]), Number(frac[2])];
  const num = Number(s.trim());
  if (Number.isNaN(num)) throw new Error(`Invalid rational: ${s}`);
  if (Number.isInteger(num)) return [num, 1];
  const den = 10_000;
  return [Math.round(num * den), den];
}

/** Parse a UI string back into the piexif value for the given tag type. */
function stringToValue(s: string, type: TagSpec['type']): unknown {
  const parts = s.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  switch (type) {
    case 'Ascii':
      return s;
    case 'Undefined':
      return s; // piexif stores Undefined as a raw byte-string
    case 'Byte':
    case 'Short':
    case 'Long':
    case 'SLong': {
      const nums = parts.map((p) => {
        const n = Number(p);
        if (!Number.isInteger(n)) throw new Error(`Invalid integer: ${p}`);
        return n;
      });
      return nums.length === 1 ? nums[0] : nums;
    }
    case 'Rational':
    case 'SRational': {
      const rationals = parts.map(parseRational);
      return rationals.length === 1 ? rationals[0] : rationals;
    }
    default:
      return s;
  }
}

/** Load the piexif dict from JPEG bytes ({} for JPEGs without EXIF). */
export function loadExifDict(jpegBytes: Uint8Array): ExifDict {
  try {
    return piexif.load(bytesToBinaryString(jpegBytes));
  } catch {
    return { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null };
  }
}

/** Flatten the dict into UI table entries. Entry id = "<ifd>/<tag>". */
export function exifDictToEntries(dict: ExifDict): MetaEntry[] {
  const entries: MetaEntry[] = [];
  for (const ifd of IFD_ORDER) {
    const table = dict[ifd];
    if (!table) continue;
    for (const [tagStr, raw] of Object.entries(table)) {
      const tag = Number(tagStr);
      const spec = tagSpec(ifd, tag);
      entries.push({
        id: `${ifd}/${tag}`,
        key: spec?.name ?? `Tag ${tag}`,
        value: valueToString(raw),
        hint: `${ifd} · ${spec?.type ?? 'Unknown'}`,
        // Values we can't round-trip as text (e.g. long binary blobs) stay read-only.
        editable: spec !== undefined,
      });
    }
  }
  return entries;
}

/** Set (or add) a tag value from its UI string. Throws on invalid input. */
export function setExifTag(dict: ExifDict, ifd: IfdName, tag: number, value: string): ExifDict {
  const spec = tagSpec(ifd, tag);
  if (!spec) throw new Error('Unknown EXIF tag');
  const next: ExifDict = { ...dict, [ifd]: { ...(dict[ifd] ?? {}) } };
  (next[ifd] as Record<number, unknown>)[tag] = stringToValue(value, spec.type);
  return next;
}

/** Remove a single tag. */
export function deleteExifTag(dict: ExifDict, ifd: IfdName, tag: number): ExifDict {
  const next: ExifDict = { ...dict, [ifd]: { ...(dict[ifd] ?? {}) } };
  delete (next[ifd] as Record<number, unknown>)[tag];
  return next;
}

/** Serialize the dict back into the JPEG. Returns new file bytes. */
export function writeExifDict(jpegBytes: Uint8Array, dict: ExifDict): Uint8Array {
  const exifBinary = piexif.dump(dict);
  const result = piexif.insert(exifBinary, bytesToBinaryString(jpegBytes));
  return binaryStringToBytes(result);
}

/** All known tags for the "Add field" dropdown, grouped by IFD. */
export function knownExifTags(): Array<{ ifd: IfdName; tag: number; name: string; type: TagSpec['type'] }> {
  const out: Array<{ ifd: IfdName; tag: number; name: string; type: TagSpec['type'] }> = [];
  const groups: Array<[IfdName, 'Image' | 'Exif' | 'GPS']> = [
    ['0th', 'Image'],
    ['Exif', 'Exif'],
    ['GPS', 'GPS'],
  ];
  for (const [ifd, group] of groups) {
    for (const [tagStr, spec] of Object.entries(piexif.TAGS[group])) {
      out.push({ ifd, tag: Number(tagStr), name: spec.name, type: spec.type });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse "<ifd>/<tag>" entry ids back into their components. */
export function parseEntryId(id: string): { ifd: IfdName; tag: number } {
  const [ifd, tag] = id.split('/');
  return { ifd: ifd as IfdName, tag: Number(tag) };
}
