/**
 * Global in-memory store for the loaded image.
 *
 * There is deliberately NO persistence here: the image, its metadata and any
 * decrypted content live only in this React context and are garbage-collected
 * the moment the tab closes or the user clicks "Close image". That is the
 * whole privacy model — data cannot leak if it never leaves this object.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ImageFormat, LoadedImage } from '@/types/image';
import { capabilitiesFor, parseImage, type ParsedMetadata } from '@/metadata/reader';
import { getJpegDimensions } from '@/metadata/jpeg';
import { getPngDimensions } from '@/metadata/png';
import { sniffFormat } from '@/utils/binary';

interface ImageStore {
  image: LoadedImage | null;
  parsed: ParsedMetadata | null;
  /** Blob URL for <img> previews — revoked automatically on replace/close. */
  previewUrl: string | null;
  loading: boolean;
  /** Load a fresh file dropped/picked by the user. */
  loadFile: (file: File) => Promise<ImageFormat>;
  /** Replace working bytes after an edit and re-parse metadata. */
  applyBytes: (bytes: Uint8Array) => Promise<void>;
  /** Throw away all edits, back to the originally loaded bytes. */
  resetToOriginal: () => Promise<void>;
  /** Forget the image entirely. */
  close: () => void;
}

const Ctx = createContext<ImageStore | null>(null);

/** MIME by sniffed format — we trust magic bytes, not file extensions. */
const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  tiff: 'image/tiff',
  heic: 'image/heic',
  avif: 'image/avif',
  unknown: 'application/octet-stream',
};

/** Get pixel size: header parse for JPEG/PNG, browser decode as fallback. */
async function measure(bytes: Uint8Array, format: ImageFormat, url: string): Promise<{ width: number; height: number }> {
  if (format === 'jpeg') {
    const dims = getJpegDimensions(bytes);
    if (dims) return dims;
  }
  if (format === 'png') {
    const dims = getPngDimensions(bytes);
    if (dims) return dims;
  }
  // Fallback: let the browser decode (works for webp/gif/avif…).
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

export function ImageStoreProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [parsed, setParsed] = useState<ParsedMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Ref so we can revoke the previous URL without re-rendering.
  const urlRef = useRef<string | null>(null);

  const swapPreviewUrl = useCallback((bytes: Uint8Array, mime: string): string => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const buffer = new Uint8Array(bytes).buffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
    urlRef.current = url;
    setPreviewUrl(url);
    return url;
  }, []);

  const loadFile = useCallback(
    async (file: File): Promise<ImageFormat> => {
      setLoading(true);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const format = sniffFormat(bytes);
        const mime = FORMAT_MIME[format];
        const url = swapPreviewUrl(bytes, mime);
        const [dims, meta] = await Promise.all([measure(bytes, format, url), parseImage(bytes, format)]);
        setImage({
          fileName: file.name,
          mime,
          format,
          bytes,
          originalBytes: bytes,
          width: dims.width,
          height: dims.height,
        });
        setParsed(meta);
        return format;
      } finally {
        setLoading(false);
      }
    },
    [swapPreviewUrl],
  );

  const applyBytes = useCallback(
    async (bytes: Uint8Array): Promise<void> => {
      if (!image) return;
      const meta = await parseImage(bytes, image.format);
      swapPreviewUrl(bytes, image.mime);
      setImage({ ...image, bytes });
      setParsed(meta);
    },
    [image, swapPreviewUrl],
  );

  const resetToOriginal = useCallback(async (): Promise<void> => {
    if (!image) return;
    const meta = await parseImage(image.originalBytes, image.format);
    swapPreviewUrl(image.originalBytes, image.mime);
    setImage({ ...image, bytes: image.originalBytes });
    setParsed(meta);
  }, [image, swapPreviewUrl]);

  const close = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreviewUrl(null);
    setImage(null);
    setParsed(null);
  }, []);

  const value = useMemo(
    () => ({ image, parsed, previewUrl, loading, loadFile, applyBytes, resetToOriginal, close }),
    [image, parsed, previewUrl, loading, loadFile, applyBytes, resetToOriginal, close],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the store; throws if the provider is missing (programmer error). */
export function useImageStore(): ImageStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useImageStore must be used inside <ImageStoreProvider>');
  return store;
}

/** Capabilities of the currently loaded format (all-false when no image). */
export function useCapabilities() {
  const { image } = useImageStore();
  return capabilitiesFor(image?.format ?? 'unknown');
}
