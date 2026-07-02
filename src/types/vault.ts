/**
 * Types for the Secure Vault — the encrypted record embedded into image XMP.
 *
 * Versioned on purpose: `MetaCryptEnvelope.version` lets future releases
 * change algorithms/KDF parameters while still decrypting old images.
 */

/** A user-defined extra field on a vault record. */
export interface VaultCustomField {
  key: string;
  value: string;
}

/** The plaintext secure record. This is what gets encrypted — never stored raw. */
export interface VaultRecord {
  title: string;
  description: string;
  username: string;
  password: string;
  url: string;
  token: string;
  notes: string;
  custom: VaultCustomField[];
}

/**
 * The encrypted envelope as embedded into the image (all binary fields are
 * base64). This is public information by design — without the password it
 * reveals nothing but the fact that MetaCrypt was used.
 */
export interface MetaCryptEnvelope {
  /** Format version — bump when the envelope layout changes. */
  version: 1;
  algorithm: 'AES-256-GCM';
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string; // base64
  };
  iv: string; // base64, 12 bytes
  ciphertext: string; // base64 (includes the GCM auth tag)
  created: string; // ISO 8601
}
