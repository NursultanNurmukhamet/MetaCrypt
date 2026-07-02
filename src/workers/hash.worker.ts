/**
 * Web Worker: computes a SHA-256 checksum of the loaded file off the main
 * thread, so dropping a large image never blocks the UI. The digest is shown
 * on the Overview tab — handy for forensics workflows (verifying that the
 * cleaner really changed the file, comparing copies, etc.).
 */

self.onmessage = async (event: MessageEvent<Uint8Array>) => {
  const bytes = event.data;
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    self.postMessage({ ok: true, hex });
  } catch {
    self.postMessage({ ok: false });
  }
};
