import type { Receipt, Voucher } from './api';
import { formatDate, formatUsdc } from './amounts';

export function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replaceAll('"', '""');
  return /[",\n\r]/.test(raw) ? `"${escaped}"` : escaped;
}

export function toCsvString(
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return '\uFEFF' + rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function buildVoucherCsvRows(
  vouchers: Voucher[],
  providerNames?: Map<string, string>,
  baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [
    ['id', 'clinic', 'service', 'amount', 'status', 'funded', 'settled or refunded date', 'transaction link'],
  ];

  for (const voucher of vouchers) {
    const clinic = providerNames?.get(voucher.provider.address) ?? voucher.provider.name;
    rows.push([
      voucher.id,
      clinic,
      voucher.serviceLabel ?? `Service ${voucher.serviceCode}`,
      formatUsdc(voucher.amount).replaceAll(',', ''),
      voucher.status,
      formatDate(voucher.createdAt),
      formatDate(voucher.disputeResolvedAt ?? voucher.attestedAt ?? voucher.claimedAt ?? voucher.createdAt),
      new URL(`/vouchers/${voucher.id}`, baseUrl).toString(),
    ]);
  }

  return rows;
}

export function buildReceiptCsvRows(
  receipts: Receipt[],
  providerNames?: Map<string, string>,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [['date', 'clinic', 'service', 'amount']];

  for (const receipt of receipts) {
    const clinic = providerNames?.get(receipt.providerAddress) ?? receipt.providerAddress;
    rows.push([
      formatDate(receipt.settledAt),
      clinic,
      receipt.serviceLabel ?? `Service ${receipt.serviceCode}`,
      receipt.amountDisplay.replaceAll(',', ''),
    ]);
  }

  return rows;
}

export function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | null | undefined>>,
): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([toCsvString(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
