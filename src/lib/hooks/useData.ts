'use client';

import useSWR, { mutate as globalMutate, type SWRConfiguration } from 'swr';

import {
  api,
  type Attester,
  type DailyStats,
  type Provider,
  type ReceiptsResponse,
  type Stats,
  type VoucherDetail,
  type VoucherEvent,
  type VouchersResponse,
} from '../api';

export type LoadedVoucher = VoucherDetail;

/**
 * Hook for fetching and caching a single voucher with its receipt (#63).
 * Automatically revalidates on window focus and network reconnect.
 */
export function useVoucher(
  id: string | null | undefined,
  config?: SWRConfiguration<LoadedVoucher>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<LoadedVoucher>(
    id ? ['voucher', id] : null,
    () => api.voucher(id!),
    config,
  );

  return {
    voucher: data ?? null,
    receipt: data?.receipt ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching a voucher's on-chain event log (#18).
 *
 * Each event carries the hash of the transaction that emitted it, so the
 * timeline can link its steps to Stellar Expert. An indexer that predates
 * the endpoint (backend #13) answers 404: the error is not retried and not
 * surfaced — the page renders the same timeline, only without the links.
 */
export function useVoucherEvents(id: string | null | undefined) {
  const { data, error, isLoading, isValidating } = useSWR<VoucherEvent[]>(
    id ? ['voucher-events', id] : null,
    () => api.voucherEvents(id!),
    { shouldRetryOnError: false },
  );

  return {
    events: data ?? [],
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
    isValidating,
  };
}

/**
 * Hook for fetching and caching vouchers matching filter criteria (#63).
 */
export function useVouchers(
  params: {
    funder?: string;
    provider?: string;
    beneficiaryRef?: string;
    status?: string;
    /** Page size; pass 1 when only `total` is used. */
    limit?: number;
  } | null,
  config?: SWRConfiguration<VouchersResponse>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    params ? ['vouchers', params] : null,
    () => api.vouchers(params!),
    config,
  );

  return {
    vouchers: data?.vouchers ?? [],
    total: data?.total ?? 0,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching a provider profile (#63).
 */
export function useProvider(
  address: string | null | undefined,
  config?: SWRConfiguration<Provider>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Provider>(
    address ? ['provider', address] : null,
    () => api.provider(address!),
    config,
  );

  return {
    provider: data ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching provider directory (#63).
 */
export function useProviders(
  params?: { status?: 'Pending' | 'Active' | 'Suspended'; country?: string; q?: string },
  config?: SWRConfiguration<{ total: number; providers: Provider[] }>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['providers', params ?? {}],
    () => api.providers(params),
    config,
  );

  return {
    providers: data?.providers ?? [],
    total: data?.total ?? 0,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching global protocol statistics (#63).
 */
export function useStats(config?: SWRConfiguration<Stats>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Stats>(
    'stats',
    () => api.stats(),
    config,
  );

  return {
    stats: data ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching daily time-series protocol statistics (#50).
 */
export function useDailyStats(days = 30, config?: SWRConfiguration<DailyStats>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DailyStats>(
    ['dailyStats', days],
    () => api.dailyStats(days),
    config,
  );

  return {
    dailyStats: data ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for fetching and caching the attester directory (#51).
 */
export function useAttesters(
  params?: { all?: boolean; limit?: number; offset?: number },
  config?: SWRConfiguration<{ total: number; limit: number; offset: number; attesters: Attester[] }>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['attesters', params ?? {}],
    () => api.attesters(params),
    config,
  );

  return {
    attesters: data?.attesters ?? [],
    total: data?.total ?? 0,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}


/**
 * Hook for fetching and caching receipts for a patient beneficiary ref (#63).
 */
export function useReceipts(
  beneficiaryRef: string | null | undefined,
  config?: SWRConfiguration<ReceiptsResponse>,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    beneficiaryRef ? ['receipts', beneficiaryRef] : null,
    () => api.receipts(beneficiaryRef!),
    config,
  );

  return {
    receipts: data?.receipts ?? [],
    total: data?.total ?? 0,
    totalSpendDisplay: data?.totalSpendDisplay ?? '0.00',
    error: error instanceof Error ? error.message : error ? String(error) : null,
    rawError: error,
    isLoading,
    isValidating,
    mutate,
  };
}

/**
 * Hook for checking if an address is an authorized attester (#63).
 */
export function useIsAttester(address: string | null | undefined) {
  const { data, error, isLoading } = useSWR(
    address ? ['isAttester', address] : null,
    async () => {
      const { registry } = await import('../protocol');
      return registry.isAttester(address!).catch(() => false);
    },
  );

  return {
    isAttester: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
}

/** Invalidate all voucher-related cache entries after a transaction */
export async function invalidateVouchers(voucherId?: string): Promise<void> {
  if (voucherId) {
    await globalMutate(['voucher', voucherId]);
    await globalMutate(['voucher-events', voucherId]);
  }
  await globalMutate(
    (key) =>
      Array.isArray(key) &&
      (key[0] === 'vouchers' || key[0] === 'receipts' || key[0] === 'voucher' || key[0] === 'voucher-events'),
  );
}

/** Invalidate all provider-related cache entries */
export async function invalidateProvider(providerAddress?: string): Promise<void> {
  if (providerAddress) {
    await globalMutate(['provider', providerAddress]);
  }
  await globalMutate(
    (key) =>
      Array.isArray(key) && (key[0] === 'providers' || key[0] === 'provider'),
  );
}
