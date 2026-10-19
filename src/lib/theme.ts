'use client';

import { useSyncExternalStore } from 'react';

/**
 * Light/dark theme (#10).
 *
 * The design tokens in `globals.css` are centralised, so the theme is a
 * second palette under `[data-theme='dark']` plus this setting: the stored
 * override, or the OS `prefers-color-scheme` when nothing is stored.
 *
 * Stored as `'light'`/`'dark'`/absent so the choice survives reloads; the
 * inline init script in the layout applies it before first paint, so there
 * is no flash of the wrong theme.
 */

const STORAGE_KEY = 'sci-theme';
const CHANGE_EVENT = 'sci-theme-change';

export type StoredTheme = 'light' | 'dark';

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The stored override, or null when following the system. */
export function getStoredTheme(): StoredTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

/** The effective theme: stored override, else the OS setting. */
export function resolveTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return getStoredTheme() ?? (systemDark() ? 'dark' : 'light');
}

function apply(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

/** Persist the override (or clear it to follow the system) and apply it. */
export function setTheme(theme: StoredTheme | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (theme) {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable; the setting applies to this page only.
  }
  apply(theme ?? (systemDark() ? 'dark' : 'light'));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The effective theme as React state; 'light' during SSR/first render. */
export function useTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, resolveTheme, () => 'light');
}

/**
 * Runs in the layout before first paint: mirrors `resolveTheme` without
 * React, so the correct palette is set before anything renders.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}`;
