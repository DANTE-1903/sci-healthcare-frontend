'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';

import { formatUsdc, toAmountInput, toBaseUnits } from '@/lib/amounts';
import { explorerTx } from '@/lib/config';
import { humaniseError, REGISTRY_ERRORS } from '@/lib/errors';
import { useLiveUpdates, useProvider, useVouchers } from '@/lib/hooks';
import { registry, type ProviderStanding } from '@/lib/protocol';
import { useWallet } from '@/lib/wallet';
import { QrScannerModal } from '@/components/QrScannerModal';
import { VoucherRow } from '@/components/VoucherRow';
import { useToast } from '@/components/Toast';
import { Button, Card, Empty, ExplorerLink } from '@/components/ui';

/** null while loading; 'Unregistered' when the registry has no entry. */
type Standing = ProviderStanding | 'Unregistered' | null;

const STANDING_TEXT: Record<Exclude<Standing, null>, string> = {
  Unregistered: 'This wallet is not registered as a clinic yet. Register below.',
  Pending:
    'Registered and awaiting verification. An administrator must verify this clinic before it can list services or receive vouchers.',
  Active: 'This clinic is verified and can receive vouchers.',
  Suspended:
    'This clinic is suspended. It cannot list services, receive new vouchers or claim funded ones. Contact the administrator.',
};

/**
 * Clinic desk.
 *
 * A clinic self-registers here and is Pending until an administrator
 * activates it. Only then can it list services or receive vouchers.
 *
 * Uses SWR caching (#63) and live updates via SSE with polling fallback (#64).
 */
export default function ClinicDeskPage() {
  const router = useRouter();
  const { address, signTransaction, connect } = useWallet();

  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const toast = useToast();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  // Delisting takes a second click, like disputing.
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  // SWR cached reads (#63)
  const { provider, mutate: mutateProvider } = useProvider(address);
  const { vouchers, mutate: mutateVouchers } = useVouchers(
    address ? { provider: address } : null,
  );
  const { data: status, mutate: mutateStatus } = useSWR(
    address ? ['registry:status', address] : null,
    () => registry.providerStatus(address!),
  );

  // Live SSE stream with automatic fallback to polling (#64)
  useLiveUpdates({ providerAddress: address ?? undefined });

  const refreshAll = () => {
    void mutateProvider();
    void mutateVouchers();
    void mutateStatus();
  };

  const standing: Standing =
    status !== undefined
      ? (status ?? 'Unregistered')
      : provider
        ? provider.status
        : null;

  const services = (provider?.services ?? []).filter((s) => s.active !== false);

  async function submit(fn: () => Promise<{ hash: string }>, table = REGISTRY_ERRORS) {
    if (!address) return void connect();
    setBusy(true);
    try {
      const res = await fn();
      setConfirmRemove(null);
      refreshAll();
      toast.success(
        <>
          Submitted.{' '}
          <ExplorerLink href={explorerTx(res.hash)}>View transaction</ExplorerLink>{' '}
          Lists update once the indexer catches up.
        </>,
      );
    } catch (err) {
      toast.error(humaniseError(err, table));
    } finally {
      setBusy(false);
    }
  }

  function edit(s: { code: number; label: string; price: string }) {
    setCode(String(s.code));
    setLabel(s.label);
    setPrice(toAmountInput(s.price));
  }

  if (!address) {
    return <Empty>Connect the clinic&apos;s wallet to manage this desk.</Empty>;
  }

  const editing = services.some((s) => String(s.code) === code);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clinic desk</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {standing === null ? 'Checking registration…' : STANDING_TEXT[standing]}
          </p>
        </div>
        <div>
          <Button
            variant="ghost"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5"
            aria-label="Scan voucher QR code"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Scan voucher QR</span>
          </Button>
        </div>
      </div>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(voucherId) => {
          setScannerOpen(false);
          router.push(`/vouchers/${voucherId}`);
        }}
      />

      {standing === 'Unregistered' && (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">Register this clinic</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clinic name"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Country code (NG)"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </div>
          <Button
            disabled={busy || !name || country.length !== 2}
            onClick={() =>
              void submit(() =>
                registry.registerProvider(address, name, country, signTransaction),
              )
            }
          >
            {busy ? 'Confirming…' : 'Register'}
          </Button>
        </Card>
      )}

      {standing === 'Active' && (
        <Card className="p-5">
          <h2 className="font-medium">Services</h2>
          {services.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              No services listed yet. Funders can only pay for services you list.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)]">
              {services.map((s) => (
                <li
                  key={s.code}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">
                      Code {s.code} · <span className="mono">${formatUsdc(s.price)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled={busy} onClick={() => edit(s)}>
                      Edit
                    </Button>
                    {confirmRemove === s.code ? (
                      <>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void submit(() =>
                              registry.removeService(address, s.code, signTransaction),
                            )
                          }
                        >
                          {busy ? 'Confirming…' : 'Confirm delist'}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmRemove(s.code)}
                      >
                        Delist
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {confirmRemove !== null && (
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              Delisting stops new vouchers for this service. Vouchers already funded keep
              their agreed amount and settle normally.
            </p>
          )}
        </Card>
      )}

      {standing === 'Active' && (
        <Card className="space-y-3 p-5">
          <h2 className="font-medium">
            {editing ? `Update service ${code}` : 'List a service'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Code (101)"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Outpatient consult"
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price in USDC, e.g. 3.00"
            className="mono w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--color-ink-soft)]">
            Use a coarse service category, never a diagnosis. Codes are public. A new
            price applies to vouchers funded from now on.
          </p>
          <Button
            disabled={busy || !code || !label || !price}
            onClick={() =>
              void submit(() =>
                registry.upsertService(
                  address,
                  Number(code),
                  label,
                  toBaseUnits(price),
                  signTransaction,
                ),
              )
            }
          >
            {busy ? 'Confirming…' : editing ? 'Update service' : 'List service'}
          </Button>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Incoming vouchers</h2>
        {vouchers.length === 0 && <Empty>No vouchers for this clinic yet.</Empty>}
        <div className="space-y-3">
          {vouchers.map((v) => (
            <VoucherRow
              key={v.id}
              v={v}
              actions={['claim', 'settle']}
              onDone={refreshAll}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
