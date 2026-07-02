/**
 * MetaCrypt payload ↔ XMP bridge.
 *
 * The encrypted envelope is stored as plain XMP properties under our own
 * namespace, so any standards-compliant XMP reader can see *that* an
 * encrypted payload exists (and its public parameters) without being able
 * to read the contents:
 *
 *   <rdf:Description xmlns:mc="https://metacrypt.app/ns/1.0/">
 *     <mc:Version>1</mc:Version>
 *     <mc:Algorithm>AES-256-GCM</mc:Algorithm>
 *     <mc:KDF>PBKDF2</mc:KDF>
 *     <mc:Iterations>600000</mc:Iterations>
 *     <mc:Salt>…base64…</mc:Salt>
 *     <mc:IV>…base64…</mc:IV>
 *     <mc:CipherText>…base64…</mc:CipherText>
 *     <mc:Created>2026-07-02T…</mc:Created>
 *   </rdf:Description>
 */

import type { XmpProperty } from '@/types/image';
import type { MetaCryptEnvelope } from '@/types/vault';
import { isValidEnvelope } from '@/crypto/aes';

export const METACRYPT_NS = 'https://metacrypt.app/ns/1.0/';
const PREFIX = 'mc';

/** Property names used inside the MetaCrypt namespace. */
const P = {
  version: 'Version',
  algorithm: 'Algorithm',
  kdf: 'KDF',
  hash: 'KDFHash',
  iterations: 'Iterations',
  salt: 'Salt',
  iv: 'IV',
  ciphertext: 'CipherText',
  created: 'Created',
} as const;

function prop(local: string, value: string): XmpProperty {
  return { prefix: PREFIX, local, namespace: METACRYPT_NS, value };
}

/** Remove any existing MetaCrypt properties (used before embed & by "remove"). */
export function withoutEnvelope(props: XmpProperty[]): XmpProperty[] {
  return props.filter((p) => p.namespace !== METACRYPT_NS);
}

/** Add envelope properties to an XMP property list (replacing older ones). */
export function embedEnvelope(props: XmpProperty[], envelope: MetaCryptEnvelope): XmpProperty[] {
  return [
    ...withoutEnvelope(props),
    prop(P.version, String(envelope.version)),
    prop(P.algorithm, envelope.algorithm),
    prop(P.kdf, envelope.kdf.name),
    prop(P.hash, envelope.kdf.hash),
    prop(P.iterations, String(envelope.kdf.iterations)),
    prop(P.salt, envelope.kdf.salt),
    prop(P.iv, envelope.iv),
    prop(P.ciphertext, envelope.ciphertext),
    prop(P.created, envelope.created),
  ];
}

/** Try to reconstruct an envelope from XMP properties. Null if absent/invalid. */
export function extractEnvelope(props: XmpProperty[]): MetaCryptEnvelope | null {
  const mc = new Map(
    props.filter((p) => p.namespace === METACRYPT_NS).map((p) => [p.local, p.value]),
  );
  if (mc.size === 0) return null;

  const candidate = {
    version: Number(mc.get(P.version)) as 1,
    algorithm: mc.get(P.algorithm) as 'AES-256-GCM',
    kdf: {
      name: (mc.get(P.kdf) ?? 'PBKDF2') as 'PBKDF2',
      hash: (mc.get(P.hash) ?? 'SHA-256') as 'SHA-256',
      iterations: Number(mc.get(P.iterations)),
      salt: mc.get(P.salt) ?? '',
    },
    iv: mc.get(P.iv) ?? '',
    ciphertext: mc.get(P.ciphertext) ?? '',
    created: mc.get(P.created) ?? '',
  };
  return isValidEnvelope(candidate) ? candidate : null;
}
