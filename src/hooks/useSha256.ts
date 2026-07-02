/**
 * useSha256 — computes the SHA-256 of the current file in a Web Worker so
 * large files never block the UI thread. Returns null while computing.
 */

import { useEffect, useState } from 'react';

export function useSha256(bytes: Uint8Array | null): string | null {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    setHash(null);
    if (!bytes) return;

    // Vite bundles this into a real worker file (module type).
    const worker = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; hex?: string }>) => {
      if (e.data.ok && e.data.hex) setHash(e.data.hex);
      worker.terminate();
    };
    // Copy so the worker owns its buffer (transfer would detach ours).
    worker.postMessage(new Uint8Array(bytes));

    return () => worker.terminate();
  }, [bytes]);

  return hash;
}
