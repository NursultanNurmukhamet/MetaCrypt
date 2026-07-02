/**
 * Unified metadata reader — turns raw image bytes into everything the UI
 * needs: editable sections, a high-level summary, and the raw tag dump.
 *
 * Reading strategy per source:
 * - ExifReader parses *everything* (EXIF/XMP/IPTC/ICC/PNG headers, any
 *   format) and powers the read-only RAW view + friendly GPS/summary info.
 * - For EDITING we parse each section ourselves (piexifjs for JPEG EXIF, own
 *   codecs for XMP/IPTC/PNG text) so that what you edit is exactly what gets
 *   written back.
 */

import ExifReader from 'exifreader';
import type {
  FormatCapabilities,
  ImageFormat,
  MetaEntry,
  MetadataSummary,
  PngTextEntry,
  XmpProperty,
} from '@/types/image';
import type { MetaCryptEnvelope } from '@/types/vault';
import type { IptcDataSet } from './iptc';
import { exifDictToEntries, loadExifDict } from './exif';
import { getJpegIptc, getJpegXmp, summarizeJpegSegments } from './jpeg';
import { getPngTextEntries, getPngXmp, summarizePng } from './png';
import { parseIptc } from './iptc';
import { parseXmp } from './xmp';
import { extractEnvelope } from './metacrypt';

/** Everything the editor screens need, parsed in one pass. */
export interface ParsedMetadata {
  summary: MetadataSummary;
  /** EXIF entries — from piexifjs on JPEG (editable), ExifReader elsewhere. */
  exifEntries: MetaEntry[];
  /** Flat XMP properties (editable on JPEG/PNG). */
  xmpProps: XmpProperty[];
  /** The verbatim XMP packet for the RAW view. */
  xmpRaw: string | null;
  /** IPTC datasets (editable on JPEG). */
  iptcSets: IptcDataSet[];
  /** PNG textual chunks (editable on PNG). */
  pngText: PngTextEntry[];
  /** ExifReader "expanded" output — feeds the RAW/Tree views. */
  raw: Record<string, unknown>;
  /** Detected MetaCrypt encrypted payload, if any. */
  envelope: MetaCryptEnvelope | null;
}

/** What the current format allows us to write. */
export function capabilitiesFor(format: ImageFormat): FormatCapabilities {
  return {
    exifWrite: format === 'jpeg',
    xmpWrite: format === 'jpeg' || format === 'png',
    iptcWrite: format === 'jpeg',
    pngTextWrite: format === 'png',
  };
}

/** Read-only EXIF entries via ExifReader (for non-JPEG formats). */
function exifEntriesFromExifReader(tags: Record<string, unknown>): MetaEntry[] {
  const entries: MetaEntry[] = [];
  for (const [key, tag] of Object.entries(tags)) {
    if (key === 'Thumbnail' || key === 'Images') continue;
    const t = tag as { description?: unknown; value?: unknown };
    const description = typeof t?.description === 'string' ? t.description : String(t?.description ?? '');
    entries.push({ id: `xr/${key}`, key, value: description, hint: 'read-only', editable: false });
  }
  return entries;
}

/** Main entry point: parse everything we know how to read. */
export async function parseImage(bytes: Uint8Array, format: ImageFormat): Promise<ParsedMetadata> {
  // --- 1) ExifReader pass (never fatal — a photo with zero metadata is fine).
  let raw: Record<string, unknown> = {};
  let gps: MetadataSummary['gps'] = null;
  try {
    // Copy into a fresh buffer: ExifReader wants an ArrayBuffer slice it owns.
    const expanded = ExifReader.load(new Uint8Array(bytes).buffer, { expanded: true });
    raw = expanded as unknown as Record<string, unknown>;
    if (expanded.gps?.Latitude !== undefined && expanded.gps?.Longitude !== undefined) {
      gps = { latitude: expanded.gps.Latitude, longitude: expanded.gps.Longitude };
    }
  } catch {
    raw = {};
  }

  // --- 2) Section-specific parsing for the editable views.
  let exifEntries: MetaEntry[] = [];
  let xmpRaw: string | null = null;
  let iptcSets: IptcDataSet[] = [];
  let pngText: PngTextEntry[] = [];

  let hasExif = false;
  let hasIptc = false;
  let hasIcc = false;

  if (format === 'jpeg') {
    const kinds = summarizeJpegSegments(bytes);
    hasExif = kinds.has('exif');
    hasIcc = kinds.has('icc');
    try {
      exifEntries = exifDictToEntries(loadExifDict(bytes));
    } catch {
      exifEntries = [];
    }
    try {
      xmpRaw = getJpegXmp(bytes);
    } catch {
      xmpRaw = null;
    }
    try {
      const iim = getJpegIptc(bytes);
      if (iim) iptcSets = parseIptc(iim);
      hasIptc = iptcSets.length > 0;
    } catch {
      iptcSets = [];
    }
  } else if (format === 'png') {
    const summary = summarizePng(bytes);
    hasExif = summary.hasExif;
    hasIcc = summary.hasIcc;
    try {
      pngText = getPngTextEntries(bytes);
      xmpRaw = getPngXmp(bytes);
    } catch {
      pngText = [];
      xmpRaw = null;
    }
    // PNG eXIf is read-only for now — show it via ExifReader.
    const exifTags = (raw as { exif?: Record<string, unknown> }).exif;
    if (exifTags) exifEntries = exifEntriesFromExifReader(exifTags);
  } else {
    // Other formats: read-only view of whatever ExifReader found.
    const r = raw as { exif?: Record<string, unknown>; iptc?: Record<string, unknown> };
    if (r.exif) {
      exifEntries = exifEntriesFromExifReader(r.exif);
      hasExif = exifEntries.length > 0;
    }
    const xmpSection = (raw as { xmp?: { _raw?: string } }).xmp;
    xmpRaw = typeof xmpSection?._raw === 'string' ? xmpSection._raw : null;
    hasIptc = Boolean(r.iptc && Object.keys(r.iptc).length > 0);
    hasIcc = Boolean((raw as { icc?: unknown }).icc);
  }

  const xmpProps = xmpRaw ? parseXmp(xmpRaw) : [];
  const envelope = extractEnvelope(xmpProps);

  const tagCount =
    exifEntries.length + xmpProps.length + iptcSets.length + pngText.length;

  return {
    summary: {
      hasExif,
      hasXmp: xmpRaw !== null,
      hasIptc: format === 'jpeg' ? iptcSets.length > 0 : hasIptc,
      hasPngText: pngText.length > 0,
      hasIcc,
      hasMetaCrypt: envelope !== null,
      tagCount,
      gps,
    },
    exifEntries,
    xmpProps,
    xmpRaw,
    iptcSets,
    pngText,
    raw,
    envelope,
  };
}
