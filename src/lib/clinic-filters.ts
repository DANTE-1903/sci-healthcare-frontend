import type { Provider } from './api';

/**
 * Client-side view state for the clinic directory (#13).
 *
 * The home page keeps the search term and country in the URL
 * (`?q=…&country=…`) so a filtered view survives a reload and can be shared.
 * Matching is pure and browser-side: the directory is small and the indexer
 * has no search endpoint.
 */

export type ClinicFilters = {
  /** Free text matched against the clinic name and its service labels. */
  q: string;
  /** Country name, or null for every country. */
  country: string | null;
};

/** The distinct countries present, in stable alphabetical order. */
export function clinicCountries(providers: Provider[]): string[] {
  return [...new Set(providers.map((p) => p.country).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** An unknown or absent `country` means "every country". */
export function parseCountry(raw: string | null, countries: string[]): string | null {
  return raw && countries.includes(raw) ? raw : null;
}

/** Name, country and service labels, lower-cased once per clinic. */
function searchText(p: Provider): string {
  return [p.name, p.country, ...p.services.map((s) => s.label)]
    .join(' ')
    .toLowerCase();
}

/**
 * Name/service text and country filtering combine: a clinic must match the
 * term *and* the chosen country. An empty term matches everything.
 */
export function filterClinics(providers: Provider[], { q, country }: ClinicFilters): Provider[] {
  const term = q.trim().toLowerCase();
  return providers.filter(
    (p) =>
      (!country || p.country === country) && (!term || searchText(p).includes(term)),
  );
}
