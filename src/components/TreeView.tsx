/**
 * TreeView — collapsible tree for the RAW metadata inspector.
 * Renders any JSON-ish value; objects/arrays expand on click.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

function isExpandable(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function Preview({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <span className="text-muted-foreground">[{value.length}]</span>;
  if (isExpandable(value)) return <span className="text-muted-foreground">{'{'}{Object.keys(value).length}{'}'}</span>;
  if (typeof value === 'string') {
    const shown = value.length > 120 ? `${value.slice(0, 120)}…` : value;
    return <span className="text-success">"{shown}"</span>;
  }
  return <span className="text-primary">{String(value)}</span>;
}

function TreeNode({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  // Auto-expand the first two levels so the tree is useful immediately.
  const [open, setOpen] = useState(depth < 2);
  const expandable = isExpandable(value);

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-accent/50"
      >
        {expandable ? (
          open ? <ChevronDown aria-hidden className="size-3 shrink-0" /> : <ChevronRight aria-hidden className="size-3 shrink-0" />
        ) : (
          <span className="inline-block w-3 shrink-0" />
        )}
        <span className="shrink-0 font-medium text-foreground">{name}</span>
        <span className="shrink-0 text-muted-foreground">:</span>
        {!open || !expandable ? <Preview value={value} /> : null}
      </button>
      {expandable && open && (
        <div role="group">
          {Object.entries(value).map(([k, v]) => (
            <TreeNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-md border bg-muted/30 p-3 scrollbar-thin">
      {Object.entries(data).map(([k, v]) => (
        <TreeNode key={k} name={k} value={v} depth={0} />
      ))}
    </div>
  );
}
