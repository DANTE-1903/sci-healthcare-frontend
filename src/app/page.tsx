'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { providerLocation, type Provider } from '@/lib/api';
import { formatUsdc } from '@/lib/amounts';
import { clinicCountries, filterClinics, parseCountry } from '@/lib/clinic-filters';
import { useLiveUpdates, useProviders, useStats } from '@/lib/hooks';
import { useLowBandwidth } from '@/lib/low-bandwidth';
import { DemoTour } from '@/components/DemoTour';
import { Alert, Button, Card, Empty } from '@/components/ui';

/**
 * Leaflet is loaded only when the map view is opened. `ssr: false` keeps
 * Leaflet (which touches `window` at import time) off the server, and the
 * dynamic import keeps its CSS and JS out of the initial bundle.
 */
const ClinicMap = dynamic(
  () => import('@/components/ClinicMap').then((m) => m.ClinicMap),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-[var(--color-ink-soft)]">Loading map…</p>
    ),
  },
);

type View = 'list' | 'map';

export default function HomePage() {
  const [view, setView] = useState<View>('list');
  const lowBandwidth = useLowBandwidth();
  useLiveUpdates();

  // The map is the heaviest thing on this page: a Leaflet chunk plus one
  // raster tile per pan. In low-bandwidth mode (#75) the list is used
  // whatever the toggle says, so switching the mode on while the map is open
  // drops it immediately, and switching it back off restores the choice.
  const activeView: View = lowBandwidth ? 'list' : view;

  // Search and country are view state, so they live in the URL — written with
  // the History API rather than a Next navigation, as on /my, so the page keeps
  // its prerendered HTML instead of moving behind a client-rendering boundary.
  const [query, setQuery] = useState('');
  // Two controls changed in quick succession would both build on the query
  // from the render before the first write landed, so build every write on the
  // last query we wrote instead.
  const queryRef = useRef('');
  useEffect(() => {
    const sync = () => {
      const next = window.location.search.replace(/^\?/, '');
      queryRef.current = next;
      setQuery(next);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(query), [query]);

  const {
    providers,
    isLoading: loading,
    error: providersError,
  } = useProviders({ status: 'Active' });
  const { stats, error: statsError } = useStats();
  const error = providersError || statsError;

  // The country list is built from the clinics present, so it can never offer
  // a filter that matches nothing.
  const countries = useMemo(() => clinicCountries(providers), [providers]);
  const searchTerm = searchParams.get('q') ?? '';
  const countryFilter = parseCountry(searchParams.get('country'), countries);
  const visible = useMemo(
    () => filterClinics(providers, { q: searchTerm, country: countryFilter }),
    [providers, searchTerm, countryFilter],
  );
  const filtering = searchTerm.trim().length > 0 || countryFilter !== null;

  // Memoized so the map is not torn down and rebuilt on every render: the
  // filter arrays are otherwise new objects each time.
  const { located, unlocated } = useMemo(() => {
    const withLocation: Provider[] = [];
    const withoutLocation: Provider[] = [];
    for (const p of visible) {
      (providerLocation(p) ? withLocation : withoutLocation).push(p);
    }
    return { located: withLocation, unlocated: withoutLocation };
  }, [visible]);

  function writeParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(queryRef.current);
    update(params);
    const next = params.toString();
    queryRef.current = next;
    setQuery(next);
    window.history.replaceState(
      window.history.state,
      '',
      next ? `${window.location.pathname}?${next}` : window.location.pathname,
    );
  }

  function setParam(key: 'q' | 'country', value: string) {
    writeParams((params) => {
      // Empty values are removed, so an unfiltered directory stays a clean link.
      if (!value) params.delete(key);
      else params.set(key, value);
    });
  }

  function clearFilters() {
    writeParams((params) => {
      params.delete('q');
      params.delete('country');
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3.5 rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-canvas)] p-4 sm:p-5">
        <div className="max-w-2xl space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Care-voucher protocol on Stellar
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Pay for care, not for promises
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--color-ink-soft)]">
            Prepaid, purpose-bound healthcare vouchers that release funds to licensed clinics only when independent attesters confirm care was delivered.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="#directory"
            className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3.5 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Browse clinics &darr;
          </a>
          <Link
            href="/how-it-works"
            className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            How it works &rarr;
          </Link>
          <Link
            href="/clinic"
            className="inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)]"
          >
            Clinic desk
          </Link>
        </div>

        <div className="grid gap-2.5 pt-0.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-blue-100 text-[11px] font-bold text-blue-800">
                1
              </span>
              <span>Escrow (Funders)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              Funders commit USDC bound to a named clinic and service. Money is held securely in smart contract escrow.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-amber-100 text-[11px] font-bold text-amber-800">
                2
              </span>
              <span>Attestation (Attesters)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              Clinics claim when seen, and independent third-party attesters verify delivery before any payment can settle.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-white/70 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-[var(--color-ink)]">
              <span className="grid h-5 w-5 place-items-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800">
                3
              </span>
              <span>Refunds (Protection)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-normal">
              If the patient never attends or care is not verified, 100% of the funds return to the funder with zero fees.
            </p>
          </div>
        </div>
      </section>

      <DemoTour />

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Clinics" value={String(stats.activeProviders)} />
          <StatTile label="Vouchers funded" value={String(stats.vouchers)} />
          <StatTile label="Care settled" value={String(stats.settledVouchers)} />
          <StatTile
            label="Value settled"
            value={`$${formatUsdc(stats.settledValue)}`}
          />
        </section>
      )}

      <section id="directory" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Verified clinics</h2>

          <div
            role="group"
            aria-label="Clinic view"
            className="flex items-center gap-0.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5"
          >
            <ViewToggle
              active={activeView === 'list'}
              onClick={() => setView('list')}
              label="List"
            />
            <ViewToggle
              active={activeView === 'map'}
              onClick={() => setView('map')}
              label="Map"
              disabled={lowBandwidth}
              disabledReason="Map tiles are skipped in low-data mode"
            />
          </div>
        </div>

        <div role="search" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block">
            <span className="sr-only">Search clinics by name or service</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search clinic name or service"
              className="h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="sr-only">Filter by country</span>
            <select
              value={countryFilter ?? ''}
              onChange={(e) => setParam('country', e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm"
            >
              <option value="">All countries</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lowBandwidth && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Low-data mode is on: the map and its tiles are skipped. Turn it off
            in the header to see clinic locations.
          </p>
        )}

        {filtering && !loading && !error && providers.length > 0 && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Showing {visible.length} of {providers.length} clinics
            {countryFilter ? ` in ${countryFilter}` : ''}.
          </p>
        )}

        {error && <Alert>{error}</Alert>}
        {loading && !error && (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading clinics…</p>
        )}

        {!loading && !error && providers.length === 0 && (
          <Empty>
            No verified clinics yet. Register one from the clinic desk, then have an
            administrator activate it.
          </Empty>
        )}

        {!loading && !error && providers.length > 0 && visible.length === 0 && (
          <Empty>
            <p>No clinics match your search.</p>
            <Button variant="ghost" className="mt-3" onClick={clearFilters}>
              Clear search and filters
            </Button>
          </Empty>
        )}

        {activeView === 'list' && visible.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((p) => (
              <ClinicCard key={p.address} provider={p} />
            ))}
          </div>
        )}

        {activeView === 'map' && visible.length > 0 && (
          <div className="space-y-3">
            {located.length > 0 ? (
              <ClinicMap providers={located} />
            ) : (
              <Empty>No clinic has published a location yet.</Empty>
            )}

            {unlocated.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Clinics without a published location
                </h3>
                <ul className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                  {unlocated.map((p) => (
                    <li key={p.address}>
                      <Link
                        href={`/clinics/${p.address}`}
                        className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-[var(--color-canvas)]"
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-[var(--color-ink-soft)]">
                          {p.country}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  disabled = false,
  disabledReason,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`rounded-md px-3 py-1 text-sm font-medium transition max-sm:min-h-11 max-sm:px-4 ${
        active
          ? 'bg-[var(--color-brand)] text-white'
          : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function ClinicCard({ provider: p }: { provider: Provider }) {
  return (
    <Link href={`/clinics/${p.address}`}>
      <Card className="h-full p-4 transition hover:border-[var(--color-brand)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-medium">{p.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              {p.country}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Verified
          </span>
        </div>

        <ul className="mt-4 space-y-1.5">
          {p.services.slice(0, 3).map((s) => (
            <li key={s.code} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 break-words text-[var(--color-ink-soft)]">{s.label}</span>
              <span className="mono shrink-0">${formatUsdc(s.price)}</span>
            </li>
          ))}
          {p.services.length === 0 && (
            <li className="text-sm text-[var(--color-ink-soft)]">
              No services listed yet
            </li>
          )}
        </ul>
      </Card>
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
