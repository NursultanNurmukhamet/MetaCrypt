/**
 * RAW tab — the forensics view: full parsed dump as JSON / XML(XMP) / HEX /
 * Tree, each with a copy button. Values are sanitized before display (long
 * arrays truncated) so a 50 MP photo can't freeze the renderer.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/CopyButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TreeView } from '@/components/TreeView';
import { useImageStore } from '@/hooks/useImageStore';

/** Bytes of the file shown in the hex dump (64 KB is plenty for headers). */
const HEX_LIMIT = 64 * 1024;

/**
 * Deep-copy a parsed metadata object into something JSON-friendly:
 * typed arrays become short previews, arrays are capped, cycles avoided
 * by depth limit. Display-only — never used for writing.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '…';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    const len = value instanceof Uint8Array ? value.length : value.byteLength;
    return `<binary ${len} bytes>`;
  }
  if (Array.isArray(value)) {
    const capped = value.slice(0, 48).map((v) => sanitize(v, depth + 1));
    if (value.length > 48) capped.push(`… ${value.length - 48} more`);
    return capped;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}

/** Classic hex dump: offset · 16 hex bytes · ASCII gutter. */
function hexDump(bytes: Uint8Array, limit: number): string {
  const n = Math.min(bytes.length, limit);
  const lines: string[] = [];
  for (let off = 0; off < n; off += 16) {
    const chunk = bytes.subarray(off, Math.min(off + 16, n));
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join('\n');
}

export function RawTab() {
  const { t } = useTranslation();
  const { image, parsed } = useImageStore();
  const [view, setView] = useState('json');

  // useMemo: these can be expensive on large files; recompute only on change.
  const sanitized = useMemo(
    () => (parsed ? (sanitize(parsed.raw) as Record<string, unknown>) : {}),
    [parsed],
  );
  const json = useMemo(() => JSON.stringify(sanitized, null, 2), [sanitized]);
  const hex = useMemo(() => (image ? hexDump(image.bytes, HEX_LIMIT) : ''), [image]);

  if (!image || !parsed) return null;

  const pre = 'max-h-[480px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed scrollbar-thin whitespace-pre';

  return (
    <Tabs value={view} onValueChange={setView}>
      <TabsList>
        <TabsTrigger value="json">{t('raw.json')}</TabsTrigger>
        <TabsTrigger value="xml">{t('raw.xml')}</TabsTrigger>
        <TabsTrigger value="hex">{t('raw.hex')}</TabsTrigger>
        <TabsTrigger value="tree">{t('raw.tree')}</TabsTrigger>
      </TabsList>

      <TabsContent value="json" className="space-y-2">
        <CopyButton text={json} />
        <pre className={pre}>{json}</pre>
      </TabsContent>

      <TabsContent value="xml" className="space-y-2">
        {parsed.xmpRaw ? (
          <>
            <CopyButton text={parsed.xmpRaw} />
            <pre className={`${pre} whitespace-pre-wrap`}>{parsed.xmpRaw}</pre>
          </>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('raw.noXmp')}
          </p>
        )}
      </TabsContent>

      <TabsContent value="hex" className="space-y-2">
        <div className="flex items-center gap-3">
          <CopyButton text={hex} />
          {image.bytes.length > HEX_LIMIT && (
            <span className="text-xs text-muted-foreground">
              {t('raw.hexShowing', {
                shown: Math.round(HEX_LIMIT / 1024),
                total: Math.round(image.bytes.length / 1024),
              })}
            </span>
          )}
        </div>
        <pre className={pre}>{hex}</pre>
      </TabsContent>

      <TabsContent value="tree">
        <TreeView data={sanitized} />
      </TabsContent>
    </Tabs>
  );
}
