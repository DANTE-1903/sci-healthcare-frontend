import type { Voucher, VoucherStatus } from './api';

/**
 * Client-side view state for the funder's voucher list.
 *
 * The `/my` page keeps these choices in the URL (`?status=…&clinic=…&sort=…`)
 * so a filtered view survives a reload and can be shared. Parsing and
 * sorting are pure functions here so the page stays about rendering.
 */

/** Lifecycle order: the filter lists statuses in the order they happen. */
export const VOUCHER_STATUSES: readonly VoucherStatus[] = [
  'Funded',
  'Claimed',
  'Attested',
  'Settled',
  'Disputed',
  'Refunded',
];

export type VoucherSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export const DEFAULT_SORT: VoucherSort = 'date-desc';

export const SORT_LABELS: Record<VoucherSort, string> = {
  'date-desc': 'Newest first',
  'date-asc': 'Oldest first',
  'amount-desc': 'Highest amount',
  'amount-asc': 'Lowest amount',
};

const SORTS = Object.keys(SORT_LABELS) as VoucherSort[];

/** An unknown or absent `status` means "all statuses". */
export function parseStatus(raw: string | null): VoucherStatus | null {
  return VOUCHER_STATUSES.find((s) => s === raw) ?? null;
}

/** An unknown or absent `sort` falls back to the default order. */
export function parseSort(raw: string | null): VoucherSort {
  return SORTS.find((s) => s === raw) ?? DEFAULT_SORT;
}

export type ClinicOption = { address: string; name: string };

/** The distinct clinics among these vouchers, by name, then address. */
export function clinicOptions(vouchers: Voucher[]): ClinicOption[] {
  const byAddress = new Map<string, string>();
  for (const v of vouchers) {
    if (!byAddress.has(v.provider.address)) {
      byAddress.set(v.provider.address, v.provider.name);
    }
  }
  return [...byAddress]
    .map(([address, name]) => ({ address, name }))
    .sort(
      (a, b) => a.name.localeCompare(b.name) || a.address.localeCompare(b.address),
    );
}

export type VoucherFilters = {
  status: VoucherStatus | null;
  /** Provider address, or null for every clinic. */
  clinic: string | null;
};

export function filterVouchers(
  vouchers: Voucher[],
  { status, clinic }: VoucherFilters,
): Voucher[] {
  return vouchers.filter(
    (v) =>
      (!status || v.status === status) &&
      (!clinic || v.provider.address === clinic),
  );
}

export function sortVouchers(vouchers: Voucher[], sort: VoucherSort): Voucher[] {
  // A copy: callers pass the SWR-cached array and must not see it reordered.
  const sorted = [...vouchers];
  switch (sort) {
    case 'date-asc':
      sorted.sort((a, b) => compareNumbers(dateOf(a), dateOf(b)));
      break;
    case 'amount-desc':
      sorted.sort((a, b) => -compareAmounts(BigInt(a.amount), BigInt(b.amount)));
      break;
    case 'amount-asc':
      sorted.sort((a, b) => compareAmounts(BigInt(a.amount), BigInt(b.amount)));
      break;
    case 'date-desc':
    default:
      sorted.sort((a, b) => compareNumbers(dateOf(b), dateOf(a)));
      break;
  }
  return sorted;
}

function dateOf(v: Voucher): number {
  // NaN (an unparseable date) sorts as the epoch rather than breaking the order.
  return new Date(v.createdAt).getTime() || 0;
}

function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** i128 amounts are decimal strings; comparing them as BigInt keeps precision. */
function compareAmounts(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
