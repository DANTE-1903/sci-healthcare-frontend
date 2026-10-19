'use client';

import { setTheme, useTheme } from '@/lib/theme';

/**
 * Header light/dark switch (#10).
 *
 * A press-and-stay-on toggle like the low-data switch: `aria-pressed`
 * carries the state. The choice overrides the OS setting and is persisted;
 * reloads apply it before paint via the layout init script, so no flash.
 */
export function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={
        dark
          ? 'Dark theme is on. Switch back to the light theme.'
          : 'Light theme is on. Switch to the dark theme, or follow your system setting by default.'
      }
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)] ring-1 ring-inset ring-[var(--color-line)] transition hover:text-[var(--color-ink)] max-sm:min-h-11 max-sm:px-3"
    >
      <span aria-hidden>{dark ? '☾' : '☀'}</span>
      {dark ? 'Dark' : 'Light'}
    </button>
  );
}
