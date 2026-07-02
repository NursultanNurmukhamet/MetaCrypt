/**
 * DropZone — the large drag & drop upload area.
 *
 * Accessibility: the whole zone is a real <button> (keyboard focusable,
 * Enter/Space opens the file picker) and drag state is mirrored via
 * aria-live-free visual styling only. Validation happens on magic bytes,
 * not extensions, inside the image store.
 */

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ImagePlus, Loader2, UploadCloud } from 'lucide-react';
import { useImageStore } from '@/hooks/useImageStore';
import { cn } from '@/utils/cn';

interface DropZoneProps {
  /** Called after the file was successfully loaded into the store. */
  onLoaded?: () => void;
  /** Compact variant used on inner pages (Vault). */
  compact?: boolean;
}

export function DropZone({ onLoaded, compact = false }: DropZoneProps) {
  const { t } = useTranslation();
  const { loadFile, loading } = useImageStore();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      try {
        const format = await loadFile(file);
        if (format === 'unknown') {
          setError(t('dropzone.unsupported'));
          return;
        }
        onLoaded?.();
      } catch {
        setError(t('errors.loadFailed'));
      }
    },
    [loadFile, onLoaded, t],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  return (
    <div>
      <motion.button
        type="button"
        aria-label={`${t('dropzone.title')} — ${t('dropzone.browse')}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'group relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors',
          compact ? 'min-h-[180px] p-6' : 'min-h-[260px] p-10',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40',
        )}
      >
        {loading ? (
          <Loader2 aria-hidden className="size-10 animate-spin text-primary" />
        ) : (
          <span
            aria-hidden
            className={cn(
              'flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform',
              dragOver ? 'scale-110' : 'group-hover:scale-105',
            )}
          >
            {dragOver ? <ImagePlus className="size-8" /> : <UploadCloud className="size-8" />}
          </span>
        )}
        <span className={cn('font-semibold', compact ? 'text-lg' : 'text-2xl')}>
          {t('dropzone.title')}
        </span>
        <span className="text-sm text-muted-foreground">{t('dropzone.or')}</span>
        <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow group-hover:bg-primary/90">
          {t('dropzone.browse')}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">{t('dropzone.hint')}</span>
      </motion.button>

      {/* Hidden real input — the button above proxies to it. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.tif,.tiff,.heic,.avif"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? undefined);
          e.target.value = ''; // allow re-selecting the same file
        }}
        tabIndex={-1}
        aria-hidden
      />

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
