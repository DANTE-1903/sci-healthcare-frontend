import type { Metadata, Viewport } from 'next';
import Link from 'next/link';

import { ConnectButton } from '@/components/ConnectButton';
import { Analytics } from '@/components/Analytics';
import { ErrorReporter } from '@/components/ErrorReporter';
import { LowBandwidthToggle } from '@/components/LowBandwidthToggle';
import { NetworkBadge } from '@/components/NetworkBadge';
import { PendingTransactionGuard } from '@/components/PendingTransactionGuard';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { SwrProvider } from '@/components/SwrProvider';
import { TestnetNotice } from '@/components/TestnetNotice';
import { ToastProvider } from '@/components/Toast';
import { WalletProvider } from '@/lib/wallet';
import { config, isTestnet } from '@/lib/config';

import { LocaleProvider } from '@/i18n/LocaleContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { HeaderNav, FooterContent } from '@/components/Navigation';

import './globals.css';

export const metadata: Metadata = {
  title: 'SCI Healthcare — care vouchers on Stellar',
  description:
    'Prepaid, purpose-bound care vouchers. Money committed to a named clinic and a named service, released when care is confirmed delivered.',
  // Installable app (#74). The manifest itself is served from
  // `src/app/manifest.ts`; declaring it here keeps the link explicit (and is
  // what makes the install prompt available at all).
  manifest: '/manifest.webmanifest',
  applicationName: 'SCI Healthcare',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'SCI Healthcare',
    statusBarStyle: 'default',
  },
};

/** Same brand colour the app paints with, so the chrome does not flash. */
export const viewport: Viewport = {
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {config.plausibleDomain ? <Analytics domain={config.plausibleDomain} /> : null}
        <ErrorReporter />
        <PendingTransactionGuard />
        <ServiceWorkerRegistration />
        <LocaleProvider>
          <WalletProvider>
            {/* Application-wide SWR defaults, relaxed in low-bandwidth mode
                (#75). The setting is read once here so every page below sees
                the same behaviour. */}
            <SwrProvider>
              <TestnetNotice />
              <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
                  <div className="flex min-w-0 items-center gap-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                      <span
                        aria-hidden
                        className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-sm text-white"
                      >
                        ✚
                      </span>
                      SCI Healthcare
                    </Link>
                    <HeaderNav />
                  </div>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <LanguageSwitcher />
                    <LowBandwidthToggle />
                    <NetworkBadge />
                    <ConnectButton />
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-6xl px-6 py-8">
                {/* Toasts live here so transaction results from any page appear
                    wherever the user is looking (#80). */}
                <ToastProvider>{children}</ToastProvider>
              </main>

              <footer className="mx-auto max-w-6xl border-t border-[var(--color-line)] px-6 py-8 text-xs text-[var(--color-ink-soft)]">
                <FooterContent isTestnet={isTestnet} />
              </footer>
            </SwrProvider>
          </WalletProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
