'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';

import { type Service } from '@/lib/api';
import {
  formatDate,
  formatUsdc,
  toAmountInput,
  toBaseUnits,
} from '@/lib/amounts';
import { trackEvent } from '@/lib/analytics';
import { beneficiaryRef, generateKey, localIdentity } from '@/lib/beneficiary';
import { invalidateVouchers, useProvider, useVouchers } from '@/lib/hooks';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { config, explorerTx } from '@/lib/config';
import { humaniseError, VOUCHER_ERRORS } from '@/lib/errors';
import {
  EXPIRY_OPTIONS,
  expiresAtFor,
  minExpiryDate,
  type ExpiryChoice,
} from '@/lib/expiry';
import { voucher } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { SavedPatientControls } from '@/components/SavedPatientControls';
import { TestUsdc } from '@/components/TestUsdc';
import { CopyValue } from '@/components/CopyValue';
import { useToast } from '@/components/Toast';
import { Alert, Button, Card, ExplorerLink, Field } from '@/components/ui';

/**
 * Registry status in the words a funder reads. A funder choosing a clinic
 * needs to know it is verified, and an unknown status is shown as such
 * rather than assumed verified.
 */
const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  Active: {
    label: 'Verified',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  Pending: {
    label: 'Verification pending',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  Suspended: {
    label: 'Suspended',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
};
const UNKNOWN_STATUS = {
  label: 'Status unknown',
  className: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function ClinicPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { address: wallet, signTransaction, connect } = useWallet();

  const { provider, error: loadError } = useProvider(address);
  const [selectedOverride, setSelectedOverride] = useState<Service | null>(null);
  const firstActive = provider?.services.find((s) => s.active !== false) ?? null;
  const selected = selectedOverride ?? firstActive;

  const saved = useSavedIdentity();
  // null until the user types, so the saved values show through.
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const amount = amountOverride ?? (selected ? toAmountInput(selected.price) : '');
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>(30);
  const [customExpiry, setCustomExpiry] = useState('');
  const [generatedKey, setGeneratedKey] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Track record for funders: how many vouchers this clinic has settled. The
  // count is filtered server-side, so it stays right as the list grows, and
  // it simply goes unrendered if the indexer cannot answer. One row is enough
  // for a total — clinic connections are often metered.
  const {
    total: settledCount,
    isLoading: loadingSettled,
    error: settledError,
  } = useVouchers({ provider: address, status: 'Settled', limit: 1 });

  // The amount as base units, or null while the field is not a number.
  const baseAmount = useMemo(() => {
    try {
      const v = toBaseUnits(amount);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount]);

  // What the clinic actually receives, read from the contract so the fee
  // shown is the fee charged. Kept with the amount it was quoted for, so a
  // stale quote is never shown against a newer amount.
  const [quote, setQuote] = useState<{ amount: bigint; fee: bigint; net: bigint } | null>(null);
  useEffect(() => {
    if (baseAmount === null) return;
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const [fee, net] = await voucher.quote(baseAmount);
        if (!ignore) setQuote({ amount: baseAmount, fee: BigInt(fee), net: BigInt(net) });
      } catch {
        // A quote is a convenience; funding still validates on chain.
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [baseAmount]);
  const currentQuote = quote && quote.amount === baseAmount ? quote : null;
  const reviewAmount = baseAmount === null ? '—' : formatUsdc(baseAmount);
  const reviewFee = currentQuote ? formatUsdc(currentQuote.fee) : '—';
  const reviewNet = currentQuote ? formatUsdc(currentQuote.net) : '—';
  const maskedSecret = secret
    ? secret.length <= 8
      ? '••••'
      : `${secret.slice(0, 4)}••••${secret.slice(-4)}`
    : '—';

  // A custom expiry is described by the date it resolves to, so the funder
  // reads the voucher's last valid day rather than the picker's raw value.
  const customExpiresAt =
    expiryChoice === 'custom' ? expiresAtFor('custom', customExpiry) : null;
  const expirySummary =
    expiryChoice === 'custom'
      ? customExpiresAt === null
        ? 'the end of the date you choose'
        : `the end of ${formatDate(new Date(customExpiresAt * 1000))}`
      : `${expiryChoice} days`;

  async function fund() {
    if (!wallet) return void connect();
    if (!selected) return;

    setBusy(true);
    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(saved.selectedNickname || 'Saved patient', identifier, secret);

      const base = toBaseUnits(amount);
      if (base < BigInt(selected.price)) {
        throw new Error(
          `The listed price is $${formatUsdc(selected.price)}. Enter at least that.`,
        );
      }

      // A preset window is counted from now; a custom date is the last second
      // of the day the funder picked.
      const expiresAt = expiresAtFor(expiryChoice, customExpiry);
      if (expiresAt === null) {
        throw new Error('Choose the date the patient must attend by.');
      }
      if (expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new Error('The expiry date must be in the future.');
      }

      const res = await voucher.create(
        {
          funder: wallet,
          beneficiaryRef: ref,
          provider: address,
          serviceCode: selected.code,
          amount: base,
          expiresAt,
        },
        signTransaction,
      );
      // create_voucher returns the new id as a u64.
      let newId: string | null = null;
      if (typeof res.returnValue === 'bigint' || typeof res.returnValue === 'number') {
        newId = String(res.returnValue);
        void invalidateVouchers(newId);
      } else {
        void invalidateVouchers();
      }
      trackEvent('voucher_funded');
      toast.success(
        <>
          Voucher funded.{' '}
          {newId && (
            <>
              <Link href={`/vouchers/${newId}`} className="underline underline-offset-2">
                Open voucher #{newId}
              </Link>{' '}
              ·{' '}
            </>
          )}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, VOUCHER_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!provider) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Loading clinic…</p>;
  }

  const status = STATUS_BADGES[provider.status] ?? UNKNOWN_STATUS;
  const registeredAt = Number.isFinite(new Date(provider.registeredAt).getTime())
    ? provider.registeredAt
    : null;
  const showSettled = !loadingSettled && !settledError;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
              <p className="mono mt-1 text-xs text-[var(--color-ink-soft)]">
                {provider.country} ·{' '}
                <CopyValue value={provider.address} chars={8} label="clinic address" />
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          {(registeredAt || showSettled) && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
              {registeredAt && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Registered
                  </dt>
                  <dd className="mt-0.5 text-sm">{formatDate(registeredAt)}</dd>
                </div>
              )}
              {showSettled && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Vouchers settled
                  </dt>
                  <dd className="mt-0.5 text-sm tabular-nums">{settledCount}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>

        <Card className="divide-y divide-[var(--color-line)]">
          {provider.services
            .filter((s) => s.active !== false)
            .map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  setSelectedOverride(s);
                  setAmountOverride(toAmountInput(s.price));
                }}
                className={`flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[var(--color-canvas)] ${
                  selected?.code === s.code ? 'bg-[var(--color-brand-soft)]/40' : ''
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">
                    Service code {s.code}
                  </div>
                </div>
                <div className="mono text-sm">${formatUsdc(s.price)}</div>
              </button>
            ))}
          {provider.services.length === 0 && (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">
              This clinic has not listed any services yet.
            </p>
          )}
        </Card>
      </div>

      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">Fund care</h2>

        {!selected && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Choose a service to fund.
          </p>
        )}

        {selected && !reviewing && (
          <>
            <Field label="Service">
              {selected.label} · ${formatUsdc(selected.price)}
            </Field>

            <SavedPatientControls
              identifier={identifier}
              keyValue={secret}
              onSelect={(patient) => {
                setIdentifier(patient?.identifier ?? '');
                setSecret(patient?.key ?? '');
              }}
            />

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient reference
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. clinic card number"
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Secret key (32+ characters)
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  type={generatedKey ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    setGeneratedKey(false);
                  }}
                  placeholder="stays on this device"
                  className="mono min-w-0 flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs"
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSecret(generateKey());
                    setGeneratedKey(true);
                  }}
                >
                  Generate
                </Button>
              </div>
              <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                Used to derive an opaque reference. Never sent anywhere, and never
                written to the ledger.
              </span>
            </label>

            {generatedKey && (
              <Alert kind="info">
                This key is the only way to look up this patient&apos;s care history
                later. Save the patient on this browser or keep a separate backup;
                the key cannot be recovered.
              </Alert>
            )}

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Amount (USDC)
              </span>
              <input
                value={amount}
                onChange={(e) => setAmountOverride(e.target.value)}
                inputMode="decimal"
                className="mono mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              {currentQuote && (
                <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                  Clinic receives ${formatUsdc(currentQuote.net)} after a $
                  {formatUsdc(currentQuote.fee)} protocol fee. Refunds are free.
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                Patient must attend within
              </span>
              <select
                value={expiryChoice}
                onChange={(e) => setExpiryChoice(e.target.value as ExpiryChoice)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                {EXPIRY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
                <option value="custom">Custom date</option>
              </select>
            </label>

            {expiryChoice === 'custom' && (
              <div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Expiry date
                  </span>
                  <input
                    type="date"
                    value={customExpiry}
                    min={minExpiryDate()}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                  />
                </label>
                <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                  The voucher is valid through this date (UTC). The contract
                  accepts any date in the future.
                </span>
              </div>
            )}

            <TestUsdc compact />

            <Button
              onClick={() => {
                if (!wallet) {
                  connect();
                  return;
                }
                setReviewing(true);
              }}
              disabled={busy}
              className="w-full"
            >
              {busy ? 'Confirming…' : wallet ? 'Fund voucher' : 'Connect wallet'}
            </Button>

            <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
              Funds are escrowed by the contract at{' '}
              <CopyValue
                value={config.contracts.voucher}
                chars={4}
                label="contract id"
              />{' '}
              and released to the clinic only after an attester confirms delivery.
              Unclaimed vouchers are refundable after {expirySummary}.
            </p>
          </>
        )}

        {selected && reviewing && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Review funding</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Check the details below before signing the voucher.
              </p>
            </div>

            <dl className="space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Clinic</dt>
                <dd className="text-right font-medium">{provider.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Service</dt>
                <dd className="text-right font-medium">
                  {selected.label} · ${formatUsdc(selected.price)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Patient reference</dt>
                <dd className="text-right font-medium">{identifier || 'Not set'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Patient key</dt>
                <dd className="mono text-right font-medium">{maskedSecret}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Amount</dt>
                <dd className="mono text-right font-medium">${reviewAmount}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Protocol fee</dt>
                <dd className="mono text-right font-medium">${reviewFee}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Clinic payout</dt>
                <dd className="mono text-right font-medium">${reviewNet}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Expires</dt>
                <dd className="text-right font-medium">{expirySummary}</dd>
              </div>
            </dl>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setReviewing(false)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => void fund()}
                disabled={busy}
              >
                {busy ? 'Confirming…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
