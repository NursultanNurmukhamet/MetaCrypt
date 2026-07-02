/**
 * Core domain types for the image currently loaded into the workspace.
 *
 * MetaCrypt never uploads anything: an image lives entirely in memory as a
 * `Uint8Array` from the moment it is dropped until the user downloads the
 * result. These types describe that in-memory model.
 */

/** Container formats we can distinguish by magic bytes. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'heic' | 'avif' | 'unknown';

/** What we are allowed to do with each metadata block for a given format. */
export interface FormatCapabilities {
  /** Read + write EXIF (currently JPEG only, via piexifjs). */
  exifWrite: boolean;
  /** Read + write an XMP packet (JPEG APP1 / PNG iTXt). */
  xmpWrite: boolean;
  /** Read + write IPTC IIM (JPEG APP13 only). */
  iptcWrite: boolean;
  /** Read + write PNG textual chunks (tEXt / zTXt / iTXt). */
  pngTextWrite: boolean;
}

/** The image being edited. `bytes` always reflects all applied edits. */
export interface LoadedImage {
  fileName: string;
  mime: string;
  format: ImageFormat;
  /** Current working bytes — every edit produces a fresh array. */
  bytes: Uint8Array;
  /** Pristine bytes as dropped by the user, kept for "reset" and diffing. */
  originalBytes: Uint8Array;
  /** Pixel dimensions, parsed from the container (not from metadata). */
  width: number;
  height: number;
}

/** A single editable metadata entry rendered in the tables. */
export interface MetaEntry {
  /** Stable identifier inside its section (e.g. "0th/271" for EXIF, keyword for PNG). */
  id: string;
  /** Human readable key (e.g. "Make", "dc:creator", "Comment"). */
  key: string;
  /** Stringified value shown/edited in the UI. */
  value: string;
  /** Optional extra info (EXIF IFD, PNG chunk type, XMP namespace URI…). */
  hint?: string;
  /** False for entries we can parse but not safely write back. */
  editable: boolean;
}

/** Parsed XMP property — pragmatic flat model (prefix:local = text value). */
export interface XmpProperty {
  prefix: string;
  local: string;
  namespace: string;
  value: string;
}

/** PNG textual chunk in editable form. */
export interface PngTextEntry {
  keyword: string;
  text: string;
  /** Which chunk type it came from / should be written as. */
  kind: 'tEXt' | 'zTXt' | 'iTXt';
  /** iTXt extras — preserved on rewrite. */
  languageTag?: string;
  translatedKeyword?: string;
}

/** High-level summary shown on the Overview tab. */
export interface MetadataSummary {
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  hasPngText: boolean;
  hasIcc: boolean;
  /** True when a MetaCrypt encrypted payload is present in the XMP packet. */
  hasMetaCrypt: boolean;
  /** Total number of individual tags across all sections. */
  tagCount: number;
  gps: { latitude: number; longitude: number } | null;
}
