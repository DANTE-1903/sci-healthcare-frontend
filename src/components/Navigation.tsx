'use client';

import Link from 'next/link';
import { useLocaleContext } from '@/i18n/LocaleContext';
import { NavLink } from '@/components/ui';

export function HeaderNav() {
  const { t } = useLocaleContext();

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      <NavLink href="/">{t('nav.clinics')}</NavLink>
      <NavLink href="/how-it-works">{t('nav.howItWorks')}</NavLink>
      <NavLink href="/my">{t('nav.myVouchers')}</NavLink>
      <NavLink href="/clinic">{t('nav.clinicDesk')}</NavLink>
      <NavLink href="/attest">{t('nav.attest')}</NavLink>
      <NavLink href="/faq">{t('nav.faq')}</NavLink>
    </nav>
  );
}

export function FooterContent({ isTestnet }: { isTestnet: boolean }) {
  const { t } = useLocaleContext();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl">
        {isTestnet ? t('footer.testnetDisclaimer') : t('footer.mainnetDisclaimer')}
      </p>
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-4 font-medium text-[var(--color-ink)]">
        <Link href="/how-it-works" className="hover:text-[var(--color-brand)]">
          {t('nav.howItWorks')}
        </Link>
        <Link href="/stats" className="hover:text-[var(--color-brand)]">
          {t('nav.stats')}
        </Link>
        <Link href="/attesters" className="hover:text-[var(--color-brand)]">
          {t('nav.attesters')}
        </Link>
        <Link href="/privacy" className="hover:text-[var(--color-brand)]">
          {t('nav.privacy')}
        </Link>
        <Link href="/faq" className="hover:text-[var(--color-brand)]">
          {t('nav.faq')}
        </Link>
        <a
          href="https://godgift-care.github.io/sci-healthcare-contracts/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-brand)]"
        >
          {t('nav.docs')}
        </a>
      </nav>
    </div>
  );
}
