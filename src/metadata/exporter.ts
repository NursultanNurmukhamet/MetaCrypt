/**
 * Metadata export / import.
 *
 * Export produces a self-describing document (JSON / XML / TXT) of every
 * parsed section. Import accepts our own JSON or XML export and returns the
 * writable parts (XMP properties + PNG text) so the editor can apply them.
 */

import type { LoadedImage, PngTextEntry, XmpProperty } from '@/types/image';
import type { ParsedMetadata } from './reader';
import { iptcFieldName } from './iptc';

/** The JSON export document shape (also what import understands). */
export interface MetadataExport {
  tool: 'MetaCrypt';
  exportVersion: 1;
  file: { name: string; format: string; width: number; height: number; size: number };
  exif: Array<{ key: string; value: string; hint?: string }>;
  xmp: Array<{ prefix: string; local: string; namespace: string; value: string }>;
  iptc: Array<{ key: string; value: string }>;
  pngText: Array<{ keyword: string; text: string; kind: string }>;
}

/** Build the neutral export model from parsed metadata. */
export function buildExport(image: LoadedImage, parsed: ParsedMetadata): MetadataExport {
  return {
    tool: 'MetaCrypt',
    exportVersion: 1,
    file: {
      name: image.fileName,
      format: image.format,
      width: image.width,
      height: image.height,
      size: image.bytes.length,
    },
    exif: parsed.exifEntries.map(({ key, value, hint }) => ({ key, value, hint })),
    xmp: parsed.xmpProps.map(({ prefix, local, namespace, value }) => ({ prefix, local, namespace, value })),
    iptc: parsed.iptcSets.map((s) => ({ key: iptcFieldName(s), value: s.value })),
    pngText: parsed.pngText.map(({ keyword, text, kind }) => ({ keyword, text, kind })),
  };
}

export function toJson(doc: MetadataExport): string {
  return JSON.stringify(doc, null, 2);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Simple, stable XML representation mirroring the JSON structure. */
export function toXml(doc: MetadataExport): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<metacrypt-export version="1">'];
  lines.push(
    `  <file name="${esc(doc.file.name)}" format="${esc(doc.file.format)}" width="${doc.file.width}" height="${doc.file.height}" size="${doc.file.size}"/>`,
  );
  lines.push('  <exif>');
  for (const e of doc.exif) lines.push(`    <tag key="${esc(e.key)}">${esc(e.value)}</tag>`);
  lines.push('  </exif>', '  <xmp>');
  for (const p of doc.xmp) {
    lines.push(
      `    <property prefix="${esc(p.prefix)}" local="${esc(p.local)}" namespace="${esc(p.namespace)}">${esc(p.value)}</property>`,
    );
  }
  lines.push('  </xmp>', '  <iptc>');
  for (const e of doc.iptc) lines.push(`    <field key="${esc(e.key)}">${esc(e.value)}</field>`);
  lines.push('  </iptc>', '  <pngText>');
  for (const t of doc.pngText) lines.push(`    <entry keyword="${esc(t.keyword)}" kind="${esc(t.kind)}">${esc(t.text)}</entry>`);
  lines.push('  </pngText>', '</metacrypt-export>');
  return lines.join('\n');
}

/** Plain-text report — for pasting into notes / tickets. */
export function toTxt(doc: MetadataExport): string {
  const lines: string[] = [
    `MetaCrypt metadata export`,
    `File: ${doc.file.name} (${doc.file.format}, ${doc.file.width}×${doc.file.height}, ${doc.file.size} bytes)`,
    '',
  ];
  const section = (title: string, rows: Array<[string, string]>) => {
    if (rows.length === 0) return;
    lines.push(`== ${title} ==`);
    for (const [k, v] of rows) lines.push(`${k}: ${v}`);
    lines.push('');
  };
  section('EXIF', doc.exif.map((e) => [e.key, e.value]));
  section('XMP', doc.xmp.map((p) => [`${p.prefix}:${p.local}`, p.value]));
  section('IPTC', doc.iptc.map((e) => [e.key, e.value]));
  section('PNG Text', doc.pngText.map((t) => [t.keyword, t.text]));
  return lines.join('\n');
}

/** What import can safely apply back onto an image. */
export interface ImportedMetadata {
  xmp: XmpProperty[];
  pngText: PngTextEntry[];
}

/** Parse an import file (our JSON or XML export). Throws on unknown shapes. */
export function parseImport(text: string): ImportedMetadata {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return parseJsonImport(trimmed);
  if (trimmed.startsWith('<')) return parseXmlImport(trimmed);
  throw new Error('unsupported-import');
}

function parseJsonImport(text: string): ImportedMetadata {
  const doc = JSON.parse(text) as Partial<MetadataExport>;
  if (!Array.isArray(doc.xmp) && !Array.isArray(doc.pngText)) throw new Error('unsupported-import');
  return {
    xmp: (doc.xmp ?? [])
      .filter((p) => p && typeof p.local === 'string' && typeof p.namespace === 'string')
      .map((p) => ({ prefix: p.prefix || 'ns', local: p.local, namespace: p.namespace, value: String(p.value ?? '') })),
    pngText: (doc.pngText ?? [])
      .filter((t) => t && typeof t.keyword === 'string')
      .map((t) => ({
        keyword: t.keyword,
        text: String(t.text ?? ''),
        kind: t.kind === 'zTXt' || t.kind === 'iTXt' ? t.kind : 'tEXt',
      })),
  };
}

function parseXmlImport(text: string): ImportedMetadata {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.tagName !== 'metacrypt-export') {
    throw new Error('unsupported-import');
  }
  const xmp: XmpProperty[] = Array.from(doc.querySelectorAll('xmp > property')).map((el) => ({
    prefix: el.getAttribute('prefix') || 'ns',
    local: el.getAttribute('local') || '',
    namespace: el.getAttribute('namespace') || '',
    value: el.textContent ?? '',
  })).filter((p) => p.local && p.namespace);

  const pngText: PngTextEntry[] = Array.from(doc.querySelectorAll('pngText > entry')).map((el) => {
    const kind = el.getAttribute('kind');
    return {
      keyword: el.getAttribute('keyword') || '',
      text: el.textContent ?? '',
      kind: kind === 'zTXt' || kind === 'iTXt' ? kind : 'tEXt',
    } as PngTextEntry;
  }).filter((t) => t.keyword);

  return { xmp, pngText };
}
