/**
 * Compatibility Checker — what happens to metadata when the image travels
 * through popular platforms. The rules are static knowledge (verified
 * empirically and from public docs); the checker combines them with what
 * the CURRENT image actually contains to produce a per-platform verdict.
 */

import type { MetadataSummary } from '@/types/image';

export type CompatStatus = 'preserved' | 'lost' | 'partial';

export interface PlatformRule {
  /** i18n key suffix, e.g. "telegramPhoto". */
  id: string;
  /** Does the platform re-encode the image (destroying metadata)? */
  status: CompatStatus;
  /** i18n key suffix for the explanation line. */
  noteKey: string;
}

/**
 * The rule table. "Photo"-style uploads are re-compressed by the platform
 * (metadata stripped); "file/document"-style uploads pass bytes through.
 */
export const PLATFORM_RULES: PlatformRule[] = [
  { id: 'telegramPhoto', status: 'lost', noteKey: 'reencoded' },
  { id: 'telegramFile', status: 'preserved', noteKey: 'passthrough' },
  { id: 'whatsapp', status: 'lost', noteKey: 'reencoded' },
  { id: 'whatsappDocument', status: 'preserved', noteKey: 'passthrough' },
  { id: 'discord', status: 'preserved', noteKey: 'passthrough' },
  { id: 'googleDrive', status: 'preserved', noteKey: 'passthrough' },
  { id: 'dropbox', status: 'preserved', noteKey: 'passthrough' },
  { id: 'email', status: 'preserved', noteKey: 'passthrough' },
  { id: 'instagram', status: 'lost', noteKey: 'reencoded' },
  { id: 'slack', status: 'preserved', noteKey: 'passthrough' },
];

export interface CompatVerdict extends PlatformRule {
  /** True when the image carries a MetaCrypt payload that this platform would destroy. */
  destroysVault: boolean;
}

/** Combine static rules with the current image's metadata summary. */
export function checkCompatibility(summary: MetadataSummary): CompatVerdict[] {
  return PLATFORM_RULES.map((rule) => ({
    ...rule,
    destroysVault: summary.hasMetaCrypt && rule.status === 'lost',
  }));
}
