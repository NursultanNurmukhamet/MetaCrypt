/**
 * Password utilities for the Secure Vault:
 * - a cryptographically secure generator (rejection sampling, no modulo bias)
 * - a lightweight strength estimator for the UI meter
 *
 * Passwords are kept in React state only for the lifetime of the operation
 * and never persisted anywhere (no localStorage, no cookies, no logs).
 */

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';

/** Uniform random int in [0, max) using rejection sampling over CSPRNG bytes. */
function secureRandomInt(max: number): number {
  const range = 0x100000000; // 2^32
  const limit = range - (range % max); // reject values that would bias the modulo
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/** Generate a random password guaranteed to contain all character classes. */
export function generatePassword(length = 20): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const classes = [LOWER, UPPER, DIGITS, SYMBOLS];
  const chars: string[] = [];

  // One character from each class first, so the guarantee always holds…
  for (const cls of classes) chars.push(cls[secureRandomInt(cls.length)]);
  // …then fill the rest from the full alphabet…
  for (let i = classes.length; i < length; i++) chars.push(all[secureRandomInt(all.length)]);
  // …and shuffle (Fisher–Yates with CSPRNG) so class positions aren't predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface PasswordStrength {
  /** 0..4 — matches the 4-segment meter in the UI. */
  score: 0 | 1 | 2 | 3 | 4;
  /** Rough entropy estimate in bits (alphabet size ^ length). */
  entropyBits: number;
}

/**
 * Estimate strength from alphabet size and length, with penalties for
 * obvious patterns. Intentionally simple — for serious auditing users should
 * rely on a real password manager; this meter is guidance, not a guarantee.
 */
export function estimateStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, entropyBits: 0 };

  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/[0-9]/.test(password)) alphabet += 10;
  if (/[^a-zA-Z0-9]/.test(password)) alphabet += 32;

  let entropyBits = password.length * Math.log2(Math.max(alphabet, 1));

  // Penalize trivially weak shapes: repeats and sequential runs.
  if (/^(.)\1+$/.test(password)) entropyBits *= 0.2;
  if (/^(0123|1234|abcd|qwer|asdf|password|qwerty)/i.test(password)) entropyBits *= 0.4;

  const score: PasswordStrength['score'] =
    entropyBits >= 90 ? 4 : entropyBits >= 65 ? 3 : entropyBits >= 45 ? 2 : entropyBits >= 25 ? 1 : 0;

  return { score, entropyBits: Math.round(entropyBits) };
}
