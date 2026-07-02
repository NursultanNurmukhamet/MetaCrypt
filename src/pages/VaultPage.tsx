/**
 * Secure Vault page.
 *
 * Two flows on one page, driven by what the loaded image contains:
 *  1. DECRYPT — if a MetaCrypt envelope is detected, ask for the password
 *     and show the decrypted record. Wrong password → one generic error.
 *  2. ENCRYPT — build a secure record, derive a key with PBKDF2 and embed
 *     the AES-256-GCM envelope into the image's XMP packet.
 *
 * Privacy invariants enforced here:
 *  - passwords/plaintext live only in local component state;
 *  - decrypted data is rendered only after explicit user action and can be
 *    hidden again;
 *  - nothing is ever persisted or logged.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LockOpen,
  Plus,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropZone } from '@/components/DropZone';
import { PasswordInput } from '@/components/PasswordInput';
import { useImageStore } from '@/hooks/useImageStore';
import type { VaultCustomField, VaultRecord } from '@/types/vault';
import { DEFAULT_ITERATIONS, decryptEnvelope, encryptToEnvelope } from '@/crypto/aes';
import { embedEnvelope, withoutEnvelope } from '@/metadata/metacrypt';
import { applyXmp } from '@/metadata/writer';
import { downloadBytes, suffixFileName } from '@/utils/download';

const EMPTY_RECORD: VaultRecord = {
  title: '',
  description: '',
  username: '',
  password: '',
  url: '',
  token: '',
  notes: '',
  custom: [],
};

/** Iteration presets for the PBKDF2 selector. */
const ITERATION_CHOICES = [300_000, 600_000, 1_000_000, 2_000_000];

/** Parse decrypted plaintext into a record, tolerating older/foreign JSON. */
function parseRecord(plaintext: string): VaultRecord {
  try {
    const raw = JSON.parse(plaintext) as Partial<VaultRecord>;
    return {
      ...EMPTY_RECORD,
      ...raw,
      custom: Array.isArray(raw.custom)
        ? raw.custom.filter((f): f is VaultCustomField => typeof f?.key === 'string')
        : [],
    };
  } catch {
    // Not JSON — show the plaintext in notes rather than losing it.
    return { ...EMPTY_RECORD, notes: plaintext };
  }
}

/** A single decrypted field row with copy + show/hide for secrets. */
function SecretRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(!secret);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-all font-mono text-sm">{visible ? value : '••••••••••••'}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        {secret && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('common.hide') : t('common.show')}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => void navigator.clipboard.writeText(value)}
          aria-label={`${t('common.copy')}: ${label}`}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function VaultPage() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();

  // ---- Encrypt-flow state ----
  const [record, setRecord] = useState<VaultRecord>(EMPTY_RECORD);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  const [busy, setBusy] = useState(false);
  const [encryptMsg, setEncryptMsg] = useState<string | null>(null);
  const [encryptErr, setEncryptErr] = useState<string | null>(null);

  // ---- Decrypt-flow state ----
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decrypted, setDecrypted] = useState<VaultRecord | null>(null);
  const [decryptErr, setDecryptErr] = useState<string | null>(null);

  // Reset transient state whenever a different image (or none) is loaded.
  // Editing metadata replaces `image.bytes`, but keeps `originalBytes`; do not
  // clear the post-encryption download prompt after a successful write.
  useEffect(() => {
    setDecrypted(null);
    setDecryptErr(null);
    setDecryptPassword('');
    setEncryptMsg(null);
    setEncryptErr(null);
  }, [image?.originalBytes]);

  const envelope = parsed?.envelope ?? null;
  const canEmbed = image != null && (image.format === 'jpeg' || image.format === 'png');
  const recordHasContent =
    Object.entries(record).some(([k, v]) => k !== 'custom' && typeof v === 'string' && v.trim() !== '') ||
    record.custom.some((f) => f.key.trim() || f.value.trim());
  const passwordsOk = password.length > 0 && password === confirm;

  const setField = <K extends keyof VaultRecord>(key: K, value: VaultRecord[K]) =>
    setRecord((r) => ({ ...r, [key]: value }));

  /** ENCRYPT: record → JSON → AES-GCM envelope → XMP → new image bytes. */
  const encrypt = async () => {
    if (!image || !parsed || !passwordsOk || !recordHasContent) return;
    setBusy(true);
    setEncryptErr(null);
    setEncryptMsg(null);
    try {
      const envelope = await encryptToEnvelope(JSON.stringify(record), password, iterations);
      const props = embedEnvelope(parsed.xmpProps, envelope);
      await applyBytes(applyXmp(image.bytes, image.format, props));
      setEncryptMsg(t('vault.encrypted'));
      // Wipe the form — plaintext should not linger once it's encrypted.
      setRecord(EMPTY_RECORD);
      setPassword('');
      setConfirm('');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setEncryptErr(message === 'xmp-too-large' ? t('errors.xmpTooLarge') : t('errors.writeFailed', { message }));
    } finally {
      setBusy(false);
    }
  };

  /** DECRYPT: envelope + password → record. Generic error on any failure. */
  const decrypt = async () => {
    if (!envelope) return;
    setBusy(true);
    setDecryptErr(null);
    try {
      const plaintext = await decryptEnvelope(envelope, decryptPassword);
      setDecrypted(parseRecord(plaintext));
      setDecryptPassword('');
    } catch {
      // Deliberately generic — never reveal whether it was a bad password,
      // corrupted data, or anything else.
      setDecryptErr(t('vault.wrongPassword'));
    } finally {
      setBusy(false);
    }
  };

  /** Remove the envelope from the image (keeps all other XMP intact). */
  const removeRecord = async () => {
    if (!image || !parsed) return;
    await applyBytes(applyXmp(image.bytes, image.format, withoutEnvelope(parsed.xmpProps)));
    setDecrypted(null);
    setEncryptMsg(t('vault.removed'));
  };

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <header className="space-y-2 text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight">
          <ShieldCheck aria-hidden className="size-8 text-primary" />
          {t('vault.title')}
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{t('vault.desc')}</p>
      </header>

      {/* No image yet → explain + let the user drop one right here. */}
      {!image && (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">{t('vault.loadForVault')}</p>
          <DropZone compact />
        </div>
      )}

      {/* ---- DECRYPT panel (auto-detected) ---- */}
      {image && envelope && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock aria-hidden className="size-5 text-primary" />
              {t('vault.detectedTitle')}
            </CardTitle>
            <CardDescription>{t('vault.detectedDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!decrypted ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void decrypt();
                }}
              >
                <div className="min-w-[240px] flex-1">
                  <PasswordInput
                    label={t('vault.record.password')}
                    value={decryptPassword}
                    onChange={setDecryptPassword}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" disabled={busy || decryptPassword.length === 0}>
                  <Unlock />
                  {t('vault.decryptBtn')}
                </Button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border p-4">
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <LockOpen aria-hidden className="size-4 text-success" />
                    {decrypted.title || t('vault.decryptedTitle')}
                  </p>
                  {decrypted.description && (
                    <p className="mb-2 text-sm text-muted-foreground">{decrypted.description}</p>
                  )}
                  <SecretRow label={t('vault.record.username')} value={decrypted.username} />
                  <SecretRow label={t('vault.record.password')} value={decrypted.password} secret />
                  <SecretRow label={t('vault.record.url')} value={decrypted.url} />
                  <SecretRow label={t('vault.record.token')} value={decrypted.token} secret />
                  <SecretRow label={t('vault.record.notes')} value={decrypted.notes} />
                  {decrypted.custom.map((f, i) => (
                    <SecretRow key={i} label={f.key} value={f.value} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setDecrypted(null)}>
                    <EyeOff />
                    {t('vault.hideRecord')}
                  </Button>
                  <Button variant="destructive" onClick={() => void removeRecord()}>
                    <Trash2 />
                    {t('vault.removeRecord')}
                  </Button>
                </div>
              </div>
            )}
            {decryptErr && (
              <p role="alert" className="text-sm font-medium text-destructive">{decryptErr}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- ENCRYPT panel ---- */}
      {image && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound aria-hidden className="size-5 text-primary" />
              {t('vault.record.legend')}
            </CardTitle>
            {!canEmbed && <CardDescription>{t('vault.unsupportedFormat')}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Record fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['title', 'text'],
                  ['username', 'text'],
                  ['url', 'url'],
                  ['token', 'text'],
                ] as const
              ).map(([key, type]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`vault-${key}`}>{t(`vault.record.${key}`)}</Label>
                  <Input
                    id={`vault-${key}`}
                    type={type}
                    value={record[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={!canEmbed}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="vault-password">{t('vault.record.password')}</Label>
                <Input
                  id="vault-password"
                  type="text"
                  value={record.password}
                  onChange={(e) => setField('password', e.target.value)}
                  disabled={!canEmbed}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vault-description">{t('vault.record.description')}</Label>
                <Input
                  id="vault-description"
                  value={record.description}
                  onChange={(e) => setField('description', e.target.value)}
                  disabled={!canEmbed}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vault-notes">{t('vault.record.notes')}</Label>
                <Textarea
                  id="vault-notes"
                  rows={3}
                  value={record.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  disabled={!canEmbed}
                />
              </div>
            </div>

            {/* Custom fields — unlimited */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('vault.record.custom')}</p>
              {record.custom.map((field, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={field.key}
                    onChange={(e) =>
                      setField('custom', record.custom.map((f, j) => (j === i ? { ...f, key: e.target.value } : f)))
                    }
                    placeholder={t('vault.record.fieldName')}
                    aria-label={t('vault.record.fieldName')}
                    className="w-1/3"
                    disabled={!canEmbed}
                  />
                  <Input
                    value={field.value}
                    onChange={(e) =>
                      setField('custom', record.custom.map((f, j) => (j === i ? { ...f, value: e.target.value } : f)))
                    }
                    placeholder={t('vault.record.fieldValue')}
                    aria-label={t('vault.record.fieldValue')}
                    className="flex-1"
                    disabled={!canEmbed}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setField('custom', record.custom.filter((_, j) => j !== i))}
                    aria-label={`${t('common.delete')}: ${field.key || i + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setField('custom', [...record.custom, { key: '', value: '' }])}
                disabled={!canEmbed}
              >
                <Plus />
                {t('vault.record.addCustom')}
              </Button>
            </div>

            {/* Encryption parameters */}
            <fieldset className="space-y-3 rounded-md border p-4">
              <legend className="px-1 text-sm font-semibold">{t('vault.encryption')}</legend>
              <PasswordInput
                label={t('vault.encryptionPassword')}
                value={password}
                onChange={setPassword}
                withStrength
                withGenerator
                autoComplete="new-password"
              />
              <PasswordInput
                label={t('vault.confirm')}
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              {confirm.length > 0 && password !== confirm && (
                <p role="alert" className="text-sm font-medium text-destructive">{t('vault.mismatch')}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="vault-iterations">{t('vault.iterations')}</Label>
                <Select
                  id="vault-iterations"
                  value={String(iterations)}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  disabled={!canEmbed}
                  className="max-w-[200px]"
                >
                  {ITERATION_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n.toLocaleString()}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">{t('vault.iterationsHint')}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t('vault.algoNote')}</p>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void encrypt()}
                disabled={!canEmbed || busy || !passwordsOk || !recordHasContent}
              >
                <Lock />
                {t('vault.encryptBtn')}
              </Button>
              {encryptMsg && image && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadBytes(image.bytes, suffixFileName(image.fileName, '-vault'), image.mime)
                  }
                >
                  <Download />
                  {t('common.download')}
                </Button>
              )}
            </div>

            {!recordHasContent && (
              <p className="text-xs text-muted-foreground">{t('vault.emptyRecord')}</p>
            )}
            {encryptMsg && <p role="status" className="text-sm font-medium text-success">{encryptMsg}</p>}
            {encryptErr && <p role="alert" className="text-sm font-medium text-destructive">{encryptErr}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
