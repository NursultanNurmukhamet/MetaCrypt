/**
 * App shell: sticky header with navigation, main outlet, informative footer.
 * The header shows a "file loaded" indicator so users always know an image
 * is in memory even when they navigate between pages.
 */

import { NavLink, Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileImage, Github, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { useImageStore } from '@/hooks/useImageStore';
import { cn } from '@/utils/cn';
import { truncateMiddle } from '@/utils/format';

const NAV_ITEMS = [
  { to: '/', key: 'nav.home' },
  { to: '/editor', key: 'nav.editor' },
  { to: '/vault', key: 'nav.vault' },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const { image, close } = useImageStore();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            <span className="hidden sm:inline">MetaCrypt</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {/* Loaded-file chip: quick reminder + close action. */}
            {image && (
              <span className="mr-1 hidden items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-2.5 pr-1 text-xs text-muted-foreground md:flex">
                <FileImage aria-hidden className="size-3.5" />
                <span className="max-w-[10rem] truncate" title={image.fileName}>
                  {truncateMiddle(image.fileName, 24)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 rounded-full"
                  onClick={close}
                  aria-label={t('common.closeImage')}
                >
                  <X className="!size-3" />
                </Button>
              </span>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="GitHub"
              title="GitHub"
              onClick={() => window.open('https://github.com/', '_blank', 'noopener')}
            >
              <Github />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="container flex flex-col items-center gap-1">
          <p className="font-medium text-foreground">{t('footer.privacy')}</p>
          <p>{t('footer.tagline')}</p>
          <p className="text-xs">{t('footer.madeWith')}</p>
        </div>
      </footer>
    </div>
  );
}
