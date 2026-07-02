/**
 * Pragmatic XMP support.
 *
 * XMP is RDF/XML — a full implementation is enormous. MetaCrypt uses a
 * deliberately flat model that covers the vast majority of real-world
 * packets: simple text properties (`prefix:local = "value"`), expressed
 * either as XML attributes or child elements of `rdf:Description`, plus
 * single-language rdf:Seq/Bag/Alt arrays (joined with "; " on read, written
 * back as rdf:Bag when the value contains "; ").
 *
 * The ORIGINAL packet is always preserved verbatim in the RAW tab; we only
 * regenerate the packet when the user actually edits XMP.
 */

import type { XmpProperty } from '@/types/image';

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const X_NS = 'adobe:ns:meta/';

/** Well-known namespaces get friendly prefixes when we serialize. */
const KNOWN_PREFIXES: Record<string, string> = {
  'http://purl.org/dc/elements/1.1/': 'dc',
  'http://ns.adobe.com/xap/1.0/': 'xmp',
  'http://ns.adobe.com/xap/1.0/rights/': 'xmpRights',
  'http://ns.adobe.com/photoshop/1.0/': 'photoshop',
  'http://ns.adobe.com/exif/1.0/': 'exif',
  'http://ns.adobe.com/tiff/1.0/': 'tiff',
  'https://metacrypt.app/ns/1.0/': 'mc',
};

/** Parse an XMP packet into flat properties. Never throws — returns []. */
export function parseXmp(packet: string): XmpProperty[] {
  const props: XmpProperty[] = [];
  try {
    const doc = new DOMParser().parseFromString(packet, 'application/xml');
    if (doc.querySelector('parsererror')) return props;

    const descriptions = doc.getElementsByTagNameNS(RDF_NS, 'Description');
    for (const desc of Array.from(descriptions)) {
      // 1) Properties serialized as attributes: <rdf:Description ns:Prop="v"/>
      for (const attr of Array.from(desc.attributes)) {
        if (!attr.namespaceURI || attr.namespaceURI === RDF_NS) continue;
        if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
        props.push({
          prefix: attr.prefix ?? 'ns',
          local: attr.localName,
          namespace: attr.namespaceURI,
          value: attr.value,
        });
      }
      // 2) Properties serialized as child elements.
      for (const child of Array.from(desc.children)) {
        if (!child.namespaceURI || child.namespaceURI === RDF_NS) continue;
        const value = readElementValue(child);
        if (value === null) continue;
        props.push({
          prefix: child.prefix ?? 'ns',
          local: child.localName,
          namespace: child.namespaceURI,
          value,
        });
      }
    }
  } catch {
    /* malformed XML — treat as no properties */
  }
  return props;
}

/** Extract a display value from a property element (text or rdf array). */
function readElementValue(el: Element): string | null {
  // rdf:Seq / rdf:Bag / rdf:Alt → join <rdf:li> items.
  const containers = ['Seq', 'Bag', 'Alt'];
  for (const name of containers) {
    const container = el.getElementsByTagNameNS(RDF_NS, name)[0];
    if (container) {
      const items = Array.from(container.getElementsByTagNameNS(RDF_NS, 'li'))
        .map((li) => li.textContent?.trim() ?? '')
        .filter(Boolean);
      return items.join('; ');
    }
  }
  // Nested rdf:Description (structs) are out of the flat model — skip them.
  if (el.getElementsByTagNameNS(RDF_NS, 'Description').length > 0) return null;
  return el.textContent?.trim() ?? '';
}

/** Escape a string for use inside XML text/attribute content. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialize flat properties into a fresh, standards-compliant XMP packet.
 * Values containing "; " become rdf:Bag arrays (mirrors how we parse them).
 */
export function serializeXmp(props: XmpProperty[]): string {
  // Assign one prefix per namespace (prefer well-known, then the parsed one).
  const nsToPrefix = new Map<string, string>();
  const used = new Set<string>();
  for (const p of props) {
    if (nsToPrefix.has(p.namespace)) continue;
    let prefix = KNOWN_PREFIXES[p.namespace] ?? p.prefix ?? 'ns';
    let candidate = prefix;
    let i = 1;
    while (used.has(candidate)) candidate = `${prefix}${i++}`;
    nsToPrefix.set(p.namespace, candidate);
    used.add(candidate);
  }

  const xmlnsDecls = Array.from(nsToPrefix.entries())
    .map(([ns, prefix]) => `xmlns:${prefix}="${xmlEscape(ns)}"`)
    .join('\n        ');

  const body = props
    .map((p) => {
      const prefix = nsToPrefix.get(p.namespace)!;
      const name = `${prefix}:${p.local}`;
      if (p.value.includes('; ')) {
        const items = p.value
          .split('; ')
          .map((v) => `            <rdf:li>${xmlEscape(v)}</rdf:li>`)
          .join('\n');
        return `        <${name}>\n          <rdf:Bag>\n${items}\n          </rdf:Bag>\n        </${name}>`;
      }
      return `        <${name}>${xmlEscape(p.value)}</${name}>`;
    })
    .join('\n');

  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    `<x:xmpmeta xmlns:x="${X_NS}" x:xmptk="MetaCrypt/0.1.0">`,
    `  <rdf:RDF xmlns:rdf="${RDF_NS}">`,
    `      <rdf:Description rdf:about=""${xmlnsDecls ? '\n        ' + xmlnsDecls : ''}>`,
    body,
    '      </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');
}
