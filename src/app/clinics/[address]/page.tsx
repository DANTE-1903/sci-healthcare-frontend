'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';

import { notFound } from 'next/navigation';

import { ApiError, type Service } from '@/lib/api';
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
import { usdc, voucher } from '@/lib/protocol';
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

  const { provider, error: loadError, rawError: loadRawError } = useProvider(address);
  // Until the funder changes the basket, the clinic's first active service
  // is selected, as before baskets existed: most funders pay for one thing.
  const [selectedCodesOverride, setSelectedCodesOverride] = useState<number[] | null>(null);
  const firstActive = provider?.services.find((s) => s.active !== false) ?? null;
  const selectedCodes = useMemo(
    () => selectedCodesOverride ?? (firstActive ? [firstActive.code] : []),
    [selectedCodesOverride, firstActive],
  );
  const setSelectedCodes = (update: (current: number[]) => number[]) =>
    setSelectedCodesOverride(update(selectedCodes));
  const selectedServices = useMemo(() => {
    if (!provider) return [] as Service[];
    return provider.services.filter((service) => selectedCodes.includes(service.code));
  }, [provider, selectedCodes]);
  const selected = selectedServices.length === 1 ? selectedServices[0] : null;

  const saved = useSavedIdentity();
  // null until the user types, so the saved values show through.
  const [identifierDraft, setIdentifier] = useState<string | null>(null);
  const [secretDraft, setSecret] = useState<string | null>(null);
  const identifier = identifierDraft ?? saved.identifier;
  const secret = secretDraft ?? saved.key;
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const selectionTotal = useMemo(
    () =>
      selectedServices.reduce(
        (total, service) => total + BigInt(service.price),
        0n,
      ),
    [selectedServices],
  );
  const amount =
    amountOverride ??
    (selected
      ? toAmountInput(selected.price)
      : selectedServices.length > 0
        ? toAmountInput(String(selectionTotal))
        : '');
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>(30);
  const [customExpiry, setCustomExpiry] = useState('');
  const [generatedKey, setGeneratedKey] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [batchSummary, setBatchSummary] = useState<{
    succeeded: string[];
    failed: { label: string; error: string }[];
  } | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!wallet) return;
    let ignore = false;
    (async () => {
      try {
        const balance = await usdc.balance(wallet);
        if (!ignore) setWalletBalance(balance);
      } catch {
        if (!ignore) setWalletBalance(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [wallet]);

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
    if (selectedServices.length > 0) return selectionTotal;
    try {
      const v = toBaseUnits(amount);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount, selectedServices.length, selectionTotal]);

  function toggleService(service: Service) {
    setSelectedCodes((current) => {
      const exists = current.includes(service.code);
      if (exists) return current.filter((code) => code !== service.code);
      return [...current, service.code];
    });
    setAmountOverride(null);
    setBatchSummary(null);
  }

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
  const insufficientUsdcBalance =
    wallet !== null &&
    baseAmount !== null &&
    walletBalance !== null &&
    walletBalance < baseAmount;
  const missingUsdcForFunding =
    wallet !== null && baseAmount !== null && walletBalance !== null && insufficientUsdcBalance;
  const usdcShortfall =
    missingUsdcForFunding ? baseAmount - walletBalance : null;
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
    if (selectedServices.length === 0) return;

    // A preset window is counted from now; a custom date is the last second
    // of the day the funder picked. Checked once, before anything is signed,
    // and shared by every voucher in the basket.
    const expiresAt = expiresAtFor(expiryChoice, customExpiry);
    if (expiresAt === null) {
      toast.error('Choose the date the patient must attend by.');
      return;
    }
    if (expiresAt <= Math.floor(Date.now() / 1000)) {
      toast.error('The expiry date must be in the future.');
      return;
    }

    // One service: the funder may pay above the listed price, never below.
    // A basket of several funds each service at its listed price.
    let singleAmount: bigint | null = null;
    if (selected) {
      try {
        singleAmount = toBaseUnits(amount);
      } catch {
        toast.error('Enter a valid amount.');
        return;
      }
      if (singleAmount < BigInt(selected.price)) {
        toast.error(`The listed price is $${formatUsdc(selected.price)}. Enter at least that.`);
        return;
      }
    }

    setBusy(true);
    setBatchSummary(null);
    const requests = selectedServices.map((service) => ({
      funder: wallet,
      beneficiaryRef: identifier,
      provider: address,
      serviceCode: service.code,
      amount: singleAmount ?? BigInt(service.price),
      expiresAt,
    }));

    const succeeded: string[] = [];
    const successfulTxs: { hash: string; id: string | null }[] = [];
    const failed: { label: string; error: string }[] = [];

    try {
      const ref = await beneficiaryRef(identifier, secret);
      localIdentity.save(saved.selectedNickname || 'Saved patient', identifier, secret);

      for (let i = 0; i < requests.length; i++) {
        const request = { ...requests[i], beneficiaryRef: ref };
        setBatchProgress({
          current: i + 1,
          total: requests.length,
          label: selectedServices[i].label,
        });

        try {
          const res = await voucher.create(request, signTransaction);
          const balance = await usdc.balance(wallet).catch(() => null);
          if (balance !== null) setWalletBalance(balance);

          let newId: string | null = null;
          if (typeof res.returnValue === 'bigint' || typeof res.returnValue === 'number') {
            newId = String(res.returnValue);
            succeeded.push(newId);
            successfulTxs.push({ hash: res.hash, id: newId });
            void invalidateVouchers(newId);
          } else {
            successfulTxs.push({ hash: res.hash, id: null });
            void invalidateVouchers();
          }
          trackEvent('voucher_funded');
        } catch (err) {
          failed.push({
            label: selectedServices[i].label,
            error: humaniseError(err, VOUCHER_ERRORS),
          });
          setBatchProgress(null);
          setBatchSummary({ succeeded, failed });
          toast.error(
            `Funded ${succeeded.length} of ${requests.length} service${requests.length === 1 ? '' : 's'} before ${selectedServices[i].label} failed: ${failed[failed.length - 1].error}`,
          );
          return;
        }
      }

      setBatchProgress(null);
      setBatchSummary({ succeeded, failed });
      const firstId = succeeded[0];
      const lastHash = successfulTxs.at(-1)?.hash ?? null;
      toast.success(
        <>
          {requests.length === 1 ? 'Voucher funded.' : `${succeeded.length} vouchers funded.`}
          {firstId && (
            <>
              {' '}
              <Link href={`/vouchers/${firstId}`} className="underline underline-offset-2">
                Open voucher #{firstId}
              </Link>
              {' '}
              ·{' '}
            </>
          )}
          {lastHash && <ExplorerLink href={explorerTx(lastHash)}>View transaction</ExplorerLink>}
        </>,
      );
    } catch (err) {
      const message = humaniseError(err, VOUCHER_ERRORS);
      setBatchProgress(null);
      setBatchSummary({ succeeded, failed: [{ label: 'Funding', error: message }] });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  // An unknown clinic is a missing page, not an API failure.
  if (loadRawError instanceof ApiError && loadRawError.status === 404) notFound();
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
            .map((s) => {
              const checked = selectedCodes.includes(s.code);
              return (
                <button
                  key={s.code}
                  onClick={() => toggleService(s)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[var(--color-canvas)] ${
                    checked ? 'bg-[var(--color-brand-soft)]/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold ${
                        checked
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-line)] bg-[var(--color-surface)] text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-[var(--color-ink-soft)]">
                        Service code {s.code}
                      </div>
                    </div>
                  </div>
                  <div className="mono text-sm">${formatUsdc(s.price)}</div>
                </button>
              );
            })}
          {provider.services.length === 0 && (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">
              This clinic has not listed any services yet.
            </p>
          )}
        </Card>
      </div>

      <Card className="h-fit space-y-4 p-5">
        <h2 className="font-medium">Fund care</h2>

        {batchProgress && (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
              <span>Funding {batchProgress.label}…</span>
              <span className="mono font-medium">
                {batchProgress.current} of {batchProgress.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
              <div
                className="h-full bg-[var(--color-brand)] transition-all duration-300"
                style={{
                  width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {batchSummary && (
          <div className="space-y-2">
            {batchSummary.succeeded.length > 0 && (
              <Alert kind="success">
                Funded {batchSummary.succeeded.length} voucher
                {batchSummary.succeeded.length === 1 ? '' : 's'} successfully (
                {batchSummary.succeeded.map((id) => `#${id}`).join(', ')}).
              </Alert>
            )}
            {batchSummary.failed.length > 0 && (
              <Alert>
                Failed to fund {batchSummary.failed.length} service
                {batchSummary.failed.length === 1 ? '' : 's'}:{' '}
                {batchSummary.failed
                  .map((failure) => `${failure.label} (${failure.error})`)
                  .join(', ')}.
              </Alert>
            )}
          </div>
        )}

        {selectedServices.length === 0 && !reviewing && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Choose one or more services to fund.
          </p>
        )}

        {selectedServices.length > 0 && !reviewing && (
          <>
            <Field label="Selected services">
              <div className="space-y-2">
                {selectedServices.map((service) => (
                  <div key={service.code} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{service.label}</span>
                    <span className="mono text-sm">${formatUsdc(service.price)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-2 text-sm font-medium">
                  <span>Total</span>
                  <span className="mono">${formatUsdc(selectionTotal)}</span>
                </div>
              </div>
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
                readOnly={selectedServices.length > 1}
                className="mono mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-[var(--color-ink-soft)]">
                  Wallet USDC balance:{' '}
                  {wallet ? (
                    walletBalance === null ? '—' : `$${formatUsdc(walletBalance)}`
                  ) : (
                    'Connect wallet'
                  )}
                </span>
                {usdcShortfall !== null && (
                  <span className="font-medium text-red-600">
                    Need ${formatUsdc(usdcShortfall)} more
                  </span>
                )}
              </div>
              {currentQuote && (
                <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                  Clinic receives ${formatUsdc(currentQuote.net)} after a $
                  {formatUsdc(currentQuote.fee)} protocol fee. Refunds are free.
                </span>
              )}
              {insufficientUsdcBalance && (
                <span className="mt-2 block text-xs text-red-600">
                  Not enough USDC in your wallet for this. You need ${formatUsdc(usdcShortfall ?? 0n)} more.
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
              disabled={busy || insufficientUsdcBalance}
              className="w-full"
            >
              {busy
                ? 'Confirming…'
                : wallet
                  ? `Fund ${selectedServices.length === 1 ? 'voucher' : `${selectedServices.length} vouchers`}`
                  : 'Connect wallet'}
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

        {selectedServices.length > 0 && reviewing && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Review funding</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Check the details below before signing{' '}
                {selectedServices.length === 1 ? 'the voucher' : `${selectedServices.length} vouchers`}.
              </p>
            </div>

            <dl className="space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Clinic</dt>
                <dd className="text-right font-medium">{provider.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--color-ink-soft)]">Services</dt>
                <dd className="text-right font-medium">
                  {selectedServices
                    .map((service) => `${service.label} · $${formatUsdc(service.price)}`)
                    .join(', ')}
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
                disabled={busy || insufficientUsdcBalance}
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
