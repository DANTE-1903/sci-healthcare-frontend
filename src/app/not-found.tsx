'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Card } from '@/components/ui';

/**
 * Shared not-found page. Unknown routes render it as-is; the voucher and
 * clinic pages call `notFound()` when the API answers 404, so the copy is
 * chosen from the URL that is still in the address bar. Every variant keeps
 * a link back into the app rather than a raw API error.
 */
const COPY = {
  voucher: {
    title: 'Voucher not found',
    body: 'There is no voucher with that number. Check the link you were sent — voucher pages need the full number, and shared links are easy to mistype.',
  },
  clinic: {
    title: 'Clinic not found',
    body: 'No clinic is registered at that address. It may have been removed from the directory, or the link may be incomplete.',
  },
  page: {
    title: 'Page not found',
    body: 'That page does not exist. It may have moved, or the link may be mistyped.',
  },
} as const;

export default function NotFound() {
  const pathname = usePathname();
  const copy = pathname.startsWith('/vouchers/')
    ? COPY.voucher
    : pathname.startsWith('/clinics/')
      ? COPY.clinic
      : COPY.page;

  return (
    <div className="mx-auto max-w-xl">
      <Card className="space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
            {copy.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <Link
            href="/"
            className="text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
          >
            Browse clinics
          </Link>
          <Link
            href="/my"
            className="text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
          >
            My vouchers
          </Link>
        </div>
      </Card>
    </div>
  );
}
