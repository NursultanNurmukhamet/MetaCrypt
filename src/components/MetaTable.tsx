/**
 * MetaTable — the shared editable key/value table used by the EXIF, XMP,
 * IPTC and PNG tabs.
 *
 * Editing model: each editable cell is an input that commits on blur or
 * Enter and reverts on Escape. After a commit the store re-parses the file,
 * so the table always displays what is REALLY in the image — if a write
 * fails, the row visibly snaps back.
 */

import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';

export interface MetaTableRow {
  id: string;
  key: string;
  value: string;
  hint?: string;
  /** Whether the VALUE can be edited. */
  editable: boolean;
  /** Whether the KEY can be renamed (XMP properties, PNG keywords). */
  keyEditable?: boolean;
}

interface MetaTableProps {
  rows: MetaTableRow[];
  /** Master switch — false renders everything read-only (format not writable). */
  editable: boolean;
  onCommit?: (id: string, patch: { key?: string; value?: string }) => void;
  onDelete?: (id: string) => void;
  /** Filter string managed by the parent tab (usually next to "Add"). */
  filter?: string;
}

/** One editable cell: uncontrolled input that commits on blur / Enter. */
function EditableCell({
  initial,
  onCommit,
  ariaLabel,
  mono = false,
}: {
  initial: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  mono?: boolean;
}) {
  const commit = (el: HTMLInputElement) => {
    if (el.value !== initial) onCommit(el.value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') {
      (e.target as HTMLInputElement).value = initial;
      (e.target as HTMLInputElement).blur();
    }
  };
  return (
    <Input
      // Remount when the underlying value changes externally (re-parse).
      key={initial}
      defaultValue={initial}
      aria-label={ariaLabel}
      onBlur={(e) => commit(e.target)}
      onKeyDown={onKeyDown}
      className={cn('h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input', mono && 'font-mono text-xs')}
    />
  );
}

export function MetaTable({ rows, editable, onCommit, onDelete, filter = '' }: MetaTableProps) {
  const { t } = useTranslation();
  const [, setRenderTick] = useState(0); // reserved for future optimistic UI
  void setRenderTick;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
        <SearchX aria-hidden className="size-5" />
        {t('table.noResults')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-[38%] px-3 py-2 font-medium">{t('common.key')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('common.value')}</th>
            {editable && <th scope="col" className="w-12 px-2 py-2" aria-label={t('common.actions')} />}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-accent/30">
              <td className="px-3 py-1.5 align-middle">
                {editable && row.keyEditable && onCommit ? (
                  <EditableCell
                    initial={row.key}
                    ariaLabel={`${t('common.key')}: ${row.key}`}
                    onCommit={(key) => onCommit(row.id, { key })}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.key}</span>
                    {row.hint && (
                      <Badge variant="secondary" className="font-normal text-muted-foreground">
                        {row.hint}
                      </Badge>
                    )}
                  </div>
                )}
              </td>
              <td className="px-3 py-1.5 align-middle">
                {editable && row.editable && onCommit ? (
                  <EditableCell
                    initial={row.value}
                    mono
                    ariaLabel={`${t('common.value')}: ${row.key}`}
                    onCommit={(value) => onCommit(row.id, { value })}
                  />
                ) : (
                  <span className="break-all font-mono text-xs text-muted-foreground" title={row.value}>
                    {row.value.length > 300 ? `${row.value.slice(0, 300)}…` : row.value}
                  </span>
                )}
              </td>
              {editable && (
                <td className="px-2 py-1.5 text-right align-middle">
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(row.id)}
                      aria-label={`${t('common.delete')}: ${row.key}`}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
