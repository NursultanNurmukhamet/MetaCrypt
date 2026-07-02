/**
 * IPTC-IIM (Information Interchange Model) codec.
 *
 * IPTC metadata in JPEG lives inside the Photoshop APP13 segment as a
 * sequence of DataSets:
 *
 *   0x1C  record(1)  dataset(1)  length(2, BE)  payload(length)
 *
 * We implement record 2 (application record) with the common editorial
 * fields, always writing UTF-8 and declaring it via the 1:90 coded-character
 * -set marker (ESC % G), which is what modern tools (exiftool, Photoshop) do.
 * Unknown datasets are preserved byte-for-byte on rewrite.
 */

import { concatBytes, utf8 } from '@/utils/binary';

/** Human names for the record-2 datasets we expose as editable fields. */
export const IPTC_FIELDS: Record<number, string> = {
  5: 'Object Name (Title)',
  25: 'Keywords',
  40: 'Special Instructions',
  55: 'Date Created',
  80: 'By-line (Author)',
  85: 'By-line Title',
  90: 'City',
  92: 'Sub-location',
  95: 'Province / State',
  101: 'Country',
  103: 'Original Transmission Reference',
  105: 'Headline',
  110: 'Credit',
  115: 'Source',
  116: 'Copyright Notice',
  120: 'Caption / Abstract',
  122: 'Caption Writer',
};

/** UTF-8 declaration for dataset 1:90 — ESC % G. */
const UTF8_MARKER = new Uint8Array([0x1b, 0x25, 0x47]);

export interface IptcDataSet {
  record: number;
  dataset: number;
  /** Decoded text for record-2 datasets; empty for binary payloads. */
  value: string;
  /** Raw payload kept for lossless round-tripping of unknown datasets. */
  raw: Uint8Array;
}

/** Parse an IIM block into datasets. Tolerant of trailing garbage. */
export function parseIptc(iim: Uint8Array): IptcDataSet[] {
  const sets: IptcDataSet[] = [];
  let off = 0;
  while (off + 5 <= iim.length) {
    if (iim[off] !== 0x1c) break; // not a DataSet marker — stop
    const record = iim[off + 1];
    const dataset = iim[off + 2];
    let length = (iim[off + 3] << 8) | iim[off + 4];
    let p = off + 5;
    // Extended datasets (>32767) are exotic; skip the file gracefully.
    if (length & 0x8000) break;
    const raw = iim.subarray(p, p + length);
    sets.push({ record, dataset, value: utf8.decode(raw), raw: new Uint8Array(raw) });
    off = p + length;
  }
  return sets;
}

/**
 * Serialize datasets back into an IIM block.
 * Injects/updates the 1:90 UTF-8 marker so consumers decode text correctly.
 */
export function serializeIptc(sets: IptcDataSet[]): Uint8Array {
  const parts: Uint8Array[] = [];

  const makeDataSet = (record: number, dataset: number, payload: Uint8Array): Uint8Array => {
    if (payload.length > 0x7fff) throw new Error('iptc-value-too-long');
    return concatBytes(
      new Uint8Array([0x1c, record, dataset, (payload.length >> 8) & 0xff, payload.length & 0xff]),
      payload,
    );
  };

  // 1:90 charset marker first (drop any pre-existing one to avoid duplicates).
  parts.push(makeDataSet(1, 90, UTF8_MARKER));

  for (const set of sets) {
    if (set.record === 1 && set.dataset === 90) continue; // replaced above
    // Known text fields are re-encoded from the edited string; everything
    // else round-trips its original bytes.
    const isKnownText = set.record === 2 && set.dataset in IPTC_FIELDS;
    parts.push(makeDataSet(set.record, set.dataset, isKnownText ? utf8.encode(set.value) : set.raw));
  }
  return concatBytes(...parts);
}

/** Display name for a dataset ("2:120 Caption / Abstract"). */
export function iptcFieldName(set: IptcDataSet): string {
  const known = set.record === 2 ? IPTC_FIELDS[set.dataset] : undefined;
  return known ?? `${set.record}:${String(set.dataset).padStart(3, '0')}`;
}

/** Is this dataset editable as text in the UI? */
export function isIptcEditable(set: IptcDataSet): boolean {
  return set.record === 2 && set.dataset in IPTC_FIELDS;
}
