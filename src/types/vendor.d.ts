/**
 * Ambient type declarations for the metadata libraries that ship without
 * TypeScript definitions. Only the surface we actually use is typed —
 * enough for the compiler to catch our own mistakes.
 */

declare module 'piexifjs' {
  /** piexif represents EXIF as nested dicts keyed by IFD name → tag id. */
  export type IfdName = '0th' | 'Exif' | 'GPS' | 'Interop' | '1st';
  export type ExifDict = {
    [K in IfdName]?: Record<number, unknown>;
  } & { thumbnail?: string | null };

  export interface TagSpec {
    name: string;
    type: 'Byte' | 'Ascii' | 'Short' | 'Long' | 'Rational' | 'Undefined' | 'SLong' | 'SRational';
  }

  /** Tag dictionaries keyed by the *spec* group name (not the IFD name). */
  export const TAGS: Record<'Image' | 'Exif' | 'GPS' | 'Interop', Record<number, TagSpec>>;

  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export const GPSIFD: Record<string, number>;

  /** All functions operate on JPEG "binary strings" (1 char = 1 byte). */
  export function load(jpegBinaryString: string): ExifDict;
  export function dump(exifDict: ExifDict): string;
  export function insert(exifBinaryString: string, jpegBinaryString: string): string;
  export function remove(jpegBinaryString: string): string;
}

declare module 'png-chunks-extract' {
  export interface PngChunk {
    name: string;
    data: Uint8Array;
  }
  /** Split a PNG file into its chunks (validates the signature and CRCs). */
  export default function extract(data: Uint8Array): PngChunk[];
}

declare module 'png-chunks-encode' {
  import type { PngChunk } from 'png-chunks-extract';
  /** Reassemble chunks into a valid PNG file (recomputes CRCs). */
  export default function encode(chunks: PngChunk[]): Uint8Array;
}

declare module 'png-chunk-text' {
  import type { PngChunk } from 'png-chunks-extract';
  /** Encode/decode Latin-1 tEXt chunks. */
  export function encode(keyword: string, content: string): PngChunk;
  export function decode(data: Uint8Array): { keyword: string; text: string };
}
