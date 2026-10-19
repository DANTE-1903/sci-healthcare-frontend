'use client';

import Link from 'next/link';
import { use, useState } from 'react';

import { formatDate, formatUsdc } from '@/lib/amounts';
import { config, explorerContract, explorerTx } from '@/lib/config';
import { useLiveUpdates, useNameIndex, useNow, useVoucher, useVoucherEvents } from '@/lib/hooks';
import { stepTxHashes, voucherTimeline, type StepState } from '@/lib/timeline';
import { useWallet } from '@/lib/wallet';
import { CopyValue } from '@/components/CopyValue';
import { VoucherQr } from '@/components/VoucherQr';
import { VoucherRow } from '@/components/VoucherRow';
import { Alert, Card, ExplorerLink, Field, StatusBadge } from '@/components/ui';

/**
 * One voucher, end to end: what it pays for, where it is in its lifecycle,
 * and the receipt once it settles. Shareable by link; everything shown is
 * already public on the ledger.
 *
 * Uses SWR caching (#63) and live updates via SSE with polling fallback (#64).
 */
export default function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address } = useWallet();
  const now = useNow();
  const names = useNameIndex();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  }

  const { voucher: v, error, mutate } = useVoucher(id);
  // Per-step transaction hashes (#18). An indexer without the events
  // endpoint (backend #13) yields an empty list and the history renders
  // exactly as before, only without the "view transaction" links.
  const { events } = useVoucherEvents(id);
  useLiveUpdates({ voucherId: id });

  if (error) return <Alert>{error}</Alert>;
  if (!v) return <p className="text-sm text-[var(--color-ink-soft)]">Loading voucher…</p>;

  // Offer the actions this wallet can take. settle and refund are
  // permissionless, so anyone may trigger them once they are due.
  const actions =
    address === v.funder
      ? (['dispute', 'refund', 'settle'] as const)
      : address === v.provider.address
        ? (['claim', 'settle'] as const)
        : (['settle', 'refund'] as const);

  const steps = voucherTimeline(v, v.receipt, now, stepTxHashes(events));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-xs text-[var(--color-ink-soft)]">Voucher #{v.id}</span>
            <StatusBadge status={v.status} />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-soft)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
              aria-label="Copy link"
            >
              {copied ? (
                <span className="font-medium text-emerald-700">Link copied!</span>
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {v.serviceLabel ?? `Service ${v.serviceCode}`}
          </h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            at{' '}
            <Link href={`/clinics/${v.provider.address}`} className="underline underline-offset-2">
              {v.provider.name}
            </Link>{' '}
            · {v.provider.country}
          </p>
        </div>
        <div className="text-right">
          <div className="mono text-2xl font-semibold">${formatUsdc(v.amount)}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">USDC</div>
        </div>
      </div>

      <VoucherQr
        voucherId={v.id}
        contractAddress={config.contracts.voucher}
        serviceLabel={v.serviceLabel ?? `Service ${v.serviceCode}`}
        providerName={v.provider.name}
        amount={formatUsdc(v.amount)}
        expiresAt={formatDate(v.expiresAt)}
      />

      <div className="grid gap-6 md:grid-cols-[2fr_1fr] print:hidden">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">History</h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s) => (
              <li key={s.label} className="flex gap-3">
                <span
                  aria-hidden
                  className={`mt-1 h-3 w-3 flex-none rounded-full ${DOT[s.state]}`}
                />
                <div className={s.state === 'skipped' ? 'opacity-50' : ''}>
                  <div className="text-sm font-medium">
                    {s.label}
                    <span className="sr-only"> ({s.state})</span>
                  </div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    {s.detail}
                    {s.at && ` · ${formatDate(s.at)}`}
                    {s.txHash && (
                      <>
                        {' · '}
                        <ExplorerLink href={explorerTx(s.txHash)}>
                          View transaction
                        </ExplorerLink>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="space-y-4 p-5">
          <Field label="Funded by">
            <CopyValue value={v.funder} name={names.get(v.funder)} label="funder address" />
          </Field>
          <Field label="Expires">{formatDate(v.expiresAt)}</Field>
          {v.status === 'Settled' && v.settledNet && (
            <Field label="Clinic received">
              <span className="mono">${formatUsdc(v.settledNet)}</span>
              {v.settledFee && (
                <span className="text-xs text-[var(--color-ink-soft)]">
                  {' '}
                  (fee ${formatUsdc(v.settledFee)})
                </span>
              )}
            </Field>
          )}
          {v.disputeOutcome && (
            <Field label="Dispute outcome">
              <span className="font-medium">
                {v.disputeOutcome}
                {v.disputeResolvedAt && ` · ${formatDate(v.disputeResolvedAt)}`}
              </span>
            </Field>
          )}
          {v.receipt && (
            <Field label="Care receipt">Minted {formatDate(v.receipt.settledAt)}</Field>
          )}
          <Field label="Patient reference">
            <CopyValue
              value={v.beneficiaryRef}
              display={`${v.beneficiaryRef.slice(0, 16)}…`}
              label="patient reference"
            />
          </Field>
          <p className="text-xs text-[var(--color-ink-soft)]">
            The patient reference is an opaque hash. It cannot be turned back into a
            name or record number.
          </p>
          <ExplorerLink href={explorerContract(config.contracts.voucher)}>
            View the voucher contract
          </ExplorerLink>
        </Card>
      </div>

      <div className="print:hidden">
        <VoucherRow
          v={v}
          actions={[...actions]}
          onDone={() => {
            void mutate();
          }}
          summary={false}
        />
      </div>
    </div>
  );
}

const DOT: Record<StepState, string> = {
  done: 'bg-[var(--color-brand)]',
  current: 'bg-amber-400 ring-4 ring-amber-100',
  upcoming: 'bg-[var(--color-line)]',
  skipped: 'bg-[var(--color-line)]',
};
