/**
 * Landing page: hero, the big drag & drop area, feature grid and a short
 * "how it works" explainer. Dropping a file loads it into the in-memory
 * store and navigates straight to the editor.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Eraser,
  FileSearch,
  Github,
  Lock,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  { key: 'local', icon: ShieldCheck },
  { key: 'editor', icon: FileSearch },
  { key: 'vault', icon: Lock },
  { key: 'cleaner', icon: Eraser },
  { key: 'offline', icon: WifiOff },
  { key: 'open', icon: Github },
] as const;

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div>
      {/* ---- Hero + DropZone ---- */}
      <section className="bg-dots border-b">
        <div className="container flex flex-col items-center gap-8 py-14 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex max-w-3xl flex-col items-center gap-4 text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck aria-hidden className="size-3.5 text-success" />
              {t('home.heroBadge')}
            </span>
            <h1 className="text-balance bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              {t('home.heroTitle')}
            </h1>
            <p className="max-w-2xl text-balance text-muted-foreground md:text-lg">
              {t('home.heroSubtitle')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-full max-w-2xl"
          >
            <DropZone onLoaded={() => navigate('/editor')} />
          </motion.div>
        </div>
      </section>

      {/* ---- Feature grid ---- */}
      <section className="container py-14" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">Features</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-2 p-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="font-semibold">{t(`home.features.${feature.key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`home.features.${feature.key}.desc`)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="border-t bg-muted/30 py-14" aria-labelledby="how-heading">
        <div className="container">
          <h2 id="how-heading" className="mb-8 text-center text-2xl font-bold tracking-tight">
            {t('home.how.title')}
          </h2>
          <ol className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {([1, 2, 3] as const).map((step) => (
              <li key={step} className="flex flex-col items-center gap-3 text-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {step}
                </span>
                <p className="text-sm text-muted-foreground">{t(`home.how.step${step}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
