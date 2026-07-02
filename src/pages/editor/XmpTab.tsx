/**
 * XMP tab — flat property editor with custom-namespace support.
 *
 * MetaCrypt vault properties (namespace https://metacrypt.app/ns/1.0/) are
 * shown read-only here: they are managed by the Vault page, and hand-editing
 * base64 ciphertext would only corrupt it.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { MetaTable, type MetaTableRow } from '@/components/MetaTable';
import { useCapabilities, useImageStore } from '@/hooks/useImageStore';
import type { XmpProperty } from '@/types/image';
import { applyXmp } from '@/metadata/writer';
import { METACRYPT_NS } from '@/metadata/metacrypt';

/** Namespace presets for the "Add property" form. */
const NS_PRESETS = [
  { prefix: 'dc', ns: 'http://purl.org/dc/elements/1.1/' },
  { prefix: 'xmp', ns: 'http://ns.adobe.com/xap/1.0/' },
  { prefix: 'photoshop', ns: 'http://ns.adobe.com/photoshop/1.0/' },
  { prefix: 'xmpRights', ns: 'http://ns.adobe.com/xap/1.0/rights/' },
];

export function XmpTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const caps = useCapabilities();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Add-property form state.
  const [nsChoice, setNsChoice] = useState(NS_PRESETS[0].ns);
  const [customNs, setCustomNs] = useState('');
  const [customPrefix, setCustomPrefix] = useState('my');
  const [propName, setPropName] = useState('');
  const [propValue, setPropValue] = useState('');

  if (!image || !parsed) return null;

  const props = parsed.xmpProps;
  // Row id = stable index into the props array.
  const rows: MetaTableRow[] = props.map((p, i) => ({
    id: String(i),
    key: `${p.prefix}:${p.local}`,
    value: p.value,
    hint: p.namespace === METACRYPT_NS ? 'MetaCrypt' : undefined,
    editable: p.namespace !== METACRYPT_NS,
    keyEditable: p.namespace !== METACRYPT_NS,
  }));

  const write = async (next: XmpProperty[]) => {
    setError(null);
    try {
      await applyBytes(applyXmp(image.bytes, image.format, next));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message === 'xmp-too-large' ? t('errors.xmpTooLarge') : t('errors.writeFailed', { message }));
    }
  };

  const onCommit = (id: string, patch: { key?: string; value?: string }) => {
    const index = Number(id);
    const next = props.map((p, i) => {
      if (i !== index) return p;
      const updated = { ...p };
      if (patch.value !== undefined) updated.value = patch.value;
      if (patch.key !== undefined) {
        // Accept "prefix:Name" or bare "Name" (keeps the current prefix).
        const [prefix, local] = patch.key.includes(':')
          ? patch.key.split(':', 2)
          : [p.prefix, patch.key];
        if (local.trim()) {
          updated.prefix = prefix.trim() || p.prefix;
          updated.local = local.trim();
        }
      }
      return updated;
    });
    void write(next);
  };

  const onDelete = (id: string) => {
    void write(props.filter((_, i) => i !== Number(id)));
  };

  const onAdd = () => {
    const ns = nsChoice === 'custom' ? customNs.trim() : nsChoice;
    const prefix =
      nsChoice === 'custom' ? customPrefix.trim() || 'my' : NS_PRESETS.find((p) => p.ns === nsChoice)!.prefix;
    if (!ns || !propName.trim()) return;
    void write([...props, { prefix, local: propName.trim(), namespace: ns, value: propValue }]);
    setPropName('');
    setPropValue('');
  };

  const hasVault = parsed.summary.hasMetaCrypt;

  return (
    <div className="space-y-3">
      {!caps.xmpWrite && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('xmp.readOnly')}</p>
      )}
      {hasVault && (
        <p className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <Lock aria-hidden className="size-4 shrink-0 text-primary" />
          {t('xmp.vaultManaged')}
        </p>
      )}

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t('table.searchPlaceholder')}
        aria-label={t('common.search')}
        className="max-w-xs"
      />

      {rows.length === 0 ? (
        <EmptyState icon={Braces} title={t('xmp.empty')} />
      ) : (
        <MetaTable rows={rows} editable={caps.xmpWrite} onCommit={onCommit} onDelete={onDelete} filter={filter} />
      )}

      {/* Add property — with custom namespace support. */}
      {caps.xmpWrite && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{t('xmp.addProperty')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Select
                aria-label={t('xmp.namespace')}
                value={nsChoice}
                onChange={(e) => setNsChoice(e.target.value)}
              >
                {NS_PRESETS.map((p) => (
                  <option key={p.ns} value={p.ns}>
                    {p.prefix} — {p.ns}
                  </option>
                ))}
                <option value="custom">{t('xmp.customNs')}</option>
              </Select>
            </div>
            {nsChoice === 'custom' && (
              <>
                <Input
                  value={customPrefix}
                  onChange={(e) => setCustomPrefix(e.target.value)}
                  placeholder={t('xmp.prefix')}
                  aria-label={t('xmp.prefix')}
                  className="w-24"
                />
                <Input
                  value={customNs}
                  onChange={(e) => setCustomNs(e.target.value)}
                  placeholder="https://example.com/ns/1.0/"
                  aria-label={t('xmp.namespace')}
                  className="min-w-[220px] flex-1"
                />
              </>
            )}
            <Input
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder={t('xmp.property')}
              aria-label={t('xmp.property')}
              className="w-40"
            />
            <Input
              value={propValue}
              onChange={(e) => setPropValue(e.target.value)}
              placeholder={t('common.value')}
              aria-label={t('common.value')}
              className="min-w-[180px] flex-1"
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            />
            <Button onClick={onAdd} disabled={!propName.trim() || (nsChoice === 'custom' && !customNs.trim())}>
              <Plus />
              {t('common.add')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('xmp.nsHint')}</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
