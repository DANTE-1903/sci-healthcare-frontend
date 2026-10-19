'use client';

import { useState } from 'react';

import { formatDate, shortAddress } from '@/lib/amounts';
import { explorerAccount } from '@/lib/config';
import { useAttesters } from '@/lib/hooks';
import { CopyValue } from '@/components/CopyValue';
import { Alert, Card, Empty, ExplorerLink } from '@/components/ui';

export default function AttestersPage() {
  const [includeInactive, setIncludeInactive] = useState(false);

  const { attesters, total, isLoading, error } = useAttesters({
    all: includeInactive,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Attester directory</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Independent third parties who verify clinical care delivery. Escrowed funds
            only release to clinics when an authorized attester confirms the patient was seen.
          </p>
        </div>

        {/* Filter */}
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink-soft)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-[var(--color-line)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          Show inactive attesters
        </label>
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading && (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading attesters…</p>
      )}

      {!isLoading && attesters.length === 0 && (
        <Empty>No active attesters found.</Empty>
      )}

      {!isLoading && attesters.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--color-ink-soft)]">
            Showing {attesters.length} of {total} registered attesters
          </div>

          {/* One table, reflowed into cards below `sm`: five columns cannot
              be read at 360px. */}
          <Card className="overflow-x-auto p-4">
            <table className="block w-full text-left text-sm sm:table">
              <caption className="sr-only">Directory of authorized attesters</caption>
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-soft)]">
                  <th scope="col" className="pb-3 font-medium">Attester / Organisation</th>
                  <th scope="col" className="pb-3 font-medium">Stellar address</th>
                  <th scope="col" className="pb-3 text-right font-medium">Confirmations</th>
                  <th scope="col" className="pb-3 font-medium">Added</th>
                  <th scope="col" className="pb-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="block space-y-3 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-[var(--color-line)]">
                {attesters.map((a) => (
                  <tr
                    key={a.address}
                    className="block rounded-2xl border border-[var(--color-line)] p-4 transition hover:bg-[var(--color-canvas)]/50 sm:rounded-none sm:border-x-0 sm:border-b-0 sm:p-0"
                  >
                    <td className="block sm:table-cell sm:py-3.5">
                      <div className="break-words font-medium text-[var(--color-ink)]">
                        {a.name || 'Accredited Medical Attester'}
                      </div>
                      <div className="text-xs text-[var(--color-ink-soft)]">
                        {a.organisation || 'Independent verifier'}
                      </div>
                    </td>
                    <td className="mt-3 block font-mono text-xs sm:mt-0 sm:table-cell sm:py-3.5">
                      <span className="inline-flex items-center gap-1">
                        <ExplorerLink href={explorerAccount(a.address)}>
                          {shortAddress(a.address, 6)}
                        </ExplorerLink>
                        <CopyValue value={a.address} buttonOnly label="attester address" />
                      </span>
                    </td>
                    <td className="mt-3 flex items-center justify-between text-sm sm:mt-0 sm:table-cell sm:py-3.5 sm:text-right">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)] sm:hidden">
                        Confirmations
                      </span>
                      <span className="font-medium">{a.attestations}</span>
                    </td>
                    <td className="mt-1 flex items-center justify-between text-xs text-[var(--color-ink-soft)] sm:mt-0 sm:table-cell sm:py-3.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide sm:hidden">
                        Added
                      </span>
                      <span>{formatDate(a.addedAt)}</span>
                    </td>
                    <td className="mt-2 flex items-center justify-between text-right sm:mt-0 sm:table-cell sm:py-3.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-soft)] sm:hidden">
                        Status
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          a.active
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
