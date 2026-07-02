/**
 * PasswordInput — input with show/hide toggle and optional generator +
 * strength meter. Used by the Vault for both encryption and decryption.
 * The value lives only in the parent's React state.
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { estimateStrength, generatePassword } from '@/crypto/password';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Show the strength meter (encryption password only). */
  withStrength?: boolean;
  /** Show the "generate" button. */
  withGenerator?: boolean;
  autoComplete?: string;
}

/** Meter color per score bucket — red → amber → green. */
const STRENGTH_COLORS = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success'];

export function PasswordInput({
  label,
  value,
  onChange,
  withStrength = false,
  withGenerator = false,
  autoComplete = 'off',
}: PasswordInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const strength = withStrength ? estimateStrength(value) : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            spellCheck={false}
            className="pr-9 font-mono"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9 w-9 text-muted-foreground"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('common.hide') : t('common.show')}
            aria-pressed={visible}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {withGenerator && (
          <Button
            variant="outline"
            onClick={() => {
              onChange(generatePassword(20));
              setVisible(true); // show the generated password so the user can save it
            }}
          >
            <RefreshCw />
            {t('common.generate')}
          </Button>
        )}
      </div>

      {strength && value.length > 0 && (
        <div className="space-y-1">
          <Progress
            value={((strength.score + 1) / 5) * 100}
            indicatorClassName={STRENGTH_COLORS[strength.score]}
            aria-label={t(`vault.strength${strength.score}`)}
          />
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>{t(`vault.strength${strength.score}`)}</span>
            <span>{t('vault.entropy', { bits: strength.entropyBits })}</span>
          </p>
        </div>
      )}
    </div>
  );
}
