/** CopyButton — copies text to the clipboard with a brief "Copied!" state. */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked — silently ignore */
    }
  }, [text]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void copy()}
      aria-label={label ?? t('common.copy')}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? t('common.copied') : label ?? t('common.copy')}
    </Button>
  );
}
