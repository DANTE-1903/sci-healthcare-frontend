'use client';

import Link from 'next/link';

import { Button, Card } from '@/components/ui';

/**
 * Route error boundary. Next renders this in place of the page when a
 * segment below the root layout throws, keeping the header and footer so a
 * reader can navigate away. Crashes above the layout (the layout itself)
 * still fall through to `global-error.tsx`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <Card className="space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
            This page could not be shown. Your wallet was not asked to sign
            anything, so no transaction was submitted.
          </p>
        </div>

        {error.digest && (
          <p className="mono text-xs text-[var(--color-ink-soft)]">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => reset()}>Try again</Button>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
          >
            Back to clinics
          </Link>
        </div>
      </Card>
    </div>
  );
}
