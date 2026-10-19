'use client';

import { setLowBandwidth, useLowBandwidth } from '@/lib/low-bandwidth';

/**
 * Header switch for low-bandwidth mode (#75).
 *
 * A press-and-stay-on toggle, not a one-shot action, so `aria-pressed`
 * carries the state and screen readers announce it. The explanation lives
 * in the accessible name and the tooltip rather than in the header, which
 * already has to fit a network badge and the wallet button at 390px.
 */
export function LowBandwidthToggle() {
  const lowBandwidth = useLowBandwidth();

  const explanation = lowBandwidth
    ? 'Low-data mode is on: no live stream, no map tiles, no analytics. Turn it off for live updates and the clinic map.'
    : 'Low-data mode: fewer requests — no live stream, no map tiles, no analytics. Useful on a slow or metered clinic connection.';

  return (
    <button
      type="button"
      aria-pressed={lowBandwidth}
      aria-label="Low data mode"
      title={explanation}
      onClick={() => setLowBandwidth(!lowBandwidth)}
      className={`inline-flex max-sm:min-h-11 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition max-sm:px-3 ${
        lowBandwidth
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
          : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)] ring-[var(--color-line)] hover:text-[var(--color-ink)]'
      }`}
    >
      <span aria-hidden className={lowBandwidth ? 'text-emerald-600' : ''}>
        {lowBandwidth ? '●' : '○'}
      </span>
      Low data
    </button>
  );
}
