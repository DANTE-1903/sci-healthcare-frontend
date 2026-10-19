import { Card } from '@/components/ui';

/**
 * Skeleton shown while a page streams in. It mirrors the shared page shape
 * (title, then an optional two-column detail layout) so navigations to the
 * dynamic voucher and clinic routes do not flash a blank canvas.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2" aria-hidden>
        <div className="h-6 w-48 animate-pulse rounded-md bg-[var(--color-line)]" />
        <div className="h-3 w-64 animate-pulse rounded-md bg-[var(--color-line)]" />
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]" aria-hidden>
        <Card className="space-y-4 p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-line)]" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1 h-3 w-3 flex-none animate-pulse rounded-full bg-[var(--color-line)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 animate-pulse rounded bg-[var(--color-line)]" />
                <div className="h-3 w-full max-w-sm animate-pulse rounded bg-[var(--color-line)]" />
              </div>
            </div>
          ))}
        </Card>

        <Card className="space-y-4 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-line)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-line)]" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
