/**
 * MetaCrypt encryption core — 100% Web Crypto API, zero dependencies.
 *
 * Scheme (envelope v1):
 *   password ──PBKDF2(SHA-256, N iterations, random 16-byte salt)──▶ AES-256 key
 *   plaintext ──AES-256-GCM(random 12-byte IV)──▶ ciphertext (+128-bit auth tag)
 *
 * Security notes:
 * - The key is derived with `extractable: false`; raw key material never
 *   exists in JS-accessible memory.
 * - GCM authenticates the data: a wrong password (or tampered payload) makes
 *   `decrypt()` throw instead of returning garbage. We surface that as one
 *   generic error — never distinguishing "wrong password" from "corrupted
 *   data" (that distinction leaks information and confuses users).
 * - A fresh salt AND a fresh IV are generated for every encryption; envelopes
 *   are never reused.
 */

import type { MetaCryptEnvelope } from '@/types/vault';
import { base64ToBytes, bytesToBase64, utf8 } from '@/utils/binary';

/** OWASP-recommended (2023+) minimum for PBKDF2-HMAC-SHA256 is 600k. */
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 5_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit IV is the recommended size for GCM.

/** Generic error used for ANY decryption failure — see security notes above. */
export class DecryptionError extends Error {
  constructor() {
    super('decryption-failed');
    this.name = 'DecryptionError';
  }
}

/** Derive a non-extractable AES-256-GCM key from a password. */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    utf8.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the derived key can never be read back out
    usage,
  );
}

/** Encrypt an arbitrary UTF-8 string into a self-describing envelope. */
export async function encryptToEnvelope(
  plaintext: string,
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<MetaCryptEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations, ['encrypt']);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    utf8.encode(plaintext) as BufferSource,
  );

  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    created: new Date().toISOString(),
  };
}

/**
 * Decrypt an envelope back into the original UTF-8 string.
 * Throws {@link DecryptionError} on ANY failure (wrong password, tampering,
 * malformed envelope) — deliberately without technical details.
 */
export async function decryptEnvelope(
  envelope: MetaCryptEnvelope,
  password: string,
): Promise<string> {
  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const iv = base64ToBytes(envelope.iv);
    const ciphertext = base64ToBytes(envelope.ciphertext);
    const key = await deriveKey(password, salt, envelope.kdf.iterations, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return utf8.decode(new Uint8Array(plaintext));
  } catch {
    throw new DecryptionError();
  }
}

/** Runtime validation for envelopes parsed from untrusted image metadata. */
export function isValidEnvelope(value: unknown): value is MetaCryptEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const kdf = v.kdf as Record<string, unknown> | undefined;
  return (
    v.version === 1 &&
    v.algorithm === 'AES-256-GCM' &&
    typeof v.iv === 'string' &&
    typeof v.ciphertext === 'string' &&
    typeof kdf === 'object' &&
    kdf !== null &&
    kdf.name === 'PBKDF2' &&
    typeof kdf.iterations === 'number' &&
    kdf.iterations > 0 &&
    typeof kdf.salt === 'string'
  );
}
