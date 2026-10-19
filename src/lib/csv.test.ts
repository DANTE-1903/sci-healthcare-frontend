import { describe, expect, it } from 'vitest';

import type { Receipt, Voucher } from './api';
import { buildReceiptCsvRows, buildVoucherCsvRows, toCsvString } from './csv';

describe('toCsvString', () => {
  it('adds a BOM and escapes embedded quotes, commas and newlines', () => {
    const csv = toCsvString([
      ['id', 'note'],
      ['A1', 'hello, "world"\nnext line'],
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"hello, ""world""\nnext line"');
  });
});

describe('buildVoucherCsvRows', () => {
  it('formats vouchers as CSV rows without thousands separators', () => {
    const voucher = {
      id: '42',
      funder: 'GDUMMY',
      beneficiaryRef: 'beneficiary',
      provider: { address: 'GA1', name: 'Clinic One', country: 'Nigeria' },
      serviceCode: 7,
      serviceLabel: 'Consultation',
      amount: '15000000',
      amountDisplay: '1.50',
      status: 'Settled',
      createdAt: '2026-05-20T10:00:00.000Z',
      expiresAt: '2026-06-20T10:00:00.000Z',
      claimedAt: '2026-05-21T12:00:00.000Z',
      attestedAt: '2026-05-22T12:00:00.000Z',
      disputeDeadline: null,
      settledNet: '15000000',
      settledFee: '0',
      isSettleable: false,
      isRefundable: false,
    } as Voucher;

    const rows = buildVoucherCsvRows([voucher], new Map([['GA1', 'Clinic One']]), 'https://example.com');

    expect(rows[0]).toEqual([
      'id',
      'clinic',
      'service',
      'amount',
      'status',
      'funded',
      'settled or refunded date',
      'transaction link',
    ]);
    expect(rows[1][3]).toBe('1.50');
    expect(rows[1][7]).toBe('https://example.com/vouchers/42');
  });
});

describe('buildReceiptCsvRows', () => {
  it('builds care history rows without commas in amounts', () => {
    const receipt = {
      voucherId: '99',
      providerAddress: 'GA9',
      serviceCode: 12,
      serviceLabel: 'X-ray',
      amount: '25000000',
      amountDisplay: '2.50',
      settledAt: '2026-05-25T00:00:00.000Z',
    } as Receipt;

    const rows = buildReceiptCsvRows([receipt], new Map([['GA9', 'Care Centre']]));

    expect(rows[0]).toEqual(['date', 'clinic', 'service', 'amount']);
    expect(rows[1]).toEqual(['25 May 2026', 'Care Centre', 'X-ray', '2.50']);
  });
});
