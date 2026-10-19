import { describe, expect, it } from 'vitest';

import { availableActions, type VoucherAction } from './voucher-actions';

/**
 * Row action rules (#8). `VoucherRow` offers exactly the actions this helper
 * returns; offering one the contract rejects is a failed transaction the
 * user still pays the fee for, so every status is pinned here.
 */

const ALL: VoucherAction[] = ['claim', 'attest', 'settle', 'refund', 'dispute'];

describe('availableActions', () => {
  it('offers only claim + dispute-window actions on a Funded voucher', () => {
    expect(
      availableActions('Funded', { isSettleable: false, isRefundable: false }, ALL),
    ).toEqual(['claim']);
  });

  it('offers attest + dispute on a Claimed voucher', () => {
    expect(
      availableActions('Claimed', { isSettleable: false, isRefundable: false }, ALL),
    ).toEqual(['attest', 'dispute']);
  });

  it('offers dispute while Attested, plus settle once the window closes', () => {
    expect(
      availableActions('Attested', { isSettleable: false, isRefundable: false }, ALL),
    ).toEqual(['dispute']);
    expect(
      availableActions('Attested', { isSettleable: true, isRefundable: false }, ALL),
    ).toEqual(['settle', 'dispute']);
  });

  it('offers nothing actionable on Settled, Disputed or Refunded rows', () => {
    for (const status of ['Settled', 'Disputed', 'Refunded'] as const) {
      expect(
        availableActions(status, { isSettleable: false, isRefundable: false }, ALL),
        status,
      ).toEqual([]);
    }
  });

  it('offers refund only when the voucher is refundable', () => {
    expect(
      availableActions('Funded', { isSettleable: false, isRefundable: true }, ['refund']),
    ).toEqual(['refund']);
    expect(
      availableActions('Funded', { isSettleable: false, isRefundable: false }, ['refund']),
    ).toEqual([]);
  });

  it('never offers an action the caller did not request', () => {
    expect(
      availableActions('Claimed', { isSettleable: true, isRefundable: true }, ['claim']),
    ).toEqual([]);
    expect(
      availableActions('Funded', { isSettleable: false, isRefundable: false }, ['attest']),
    ).toEqual([]);
  });

  it('preserves the requested order', () => {
    expect(
      availableActions(
        'Claimed',
        { isSettleable: false, isRefundable: false },
        ['dispute', 'attest'],
      ),
    ).toEqual(['dispute', 'attest']);
  });
});
