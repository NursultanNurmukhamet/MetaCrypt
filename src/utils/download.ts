/**
 * Client-side file download helpers.
 * This is the ONLY way data ever leaves MetaCrypt — straight to the user's
 * own disk via a Blob URL. No network requests are involved.
 */

/** Trigger a browser download for arbitrary bytes. */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  // Copy into a fresh ArrayBuffer so the Blob never aliases a SharedArrayBuffer view.
  const buffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([buffer], { type: mime });
  downloadBlob(blob, fileName);
}

/** Trigger a browser download for a text document (exports: JSON/XML/TXT). */
export function downloadText(text: string, fileName: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), fileName);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke asynchronously: some browsers cancel the download if revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** "photo.jpg" + "-clean" → "photo-clean.jpg" (suffix before the extension). */
export function suffixFileName(fileName: string, suffix: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return fileName + suffix;
  return fileName.slice(0, dot) + suffix + fileName.slice(dot);
}
