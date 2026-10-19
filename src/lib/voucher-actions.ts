import type { VoucherStatus } from './api';

/** Actions the UI can offer on a voucher row. */
export type VoucherAction = 'claim' | 'attest' | 'settle' | 'refund' | 'dispute';

/**
 * Which of the requested actions the contract will actually accept right
 * now (#8).
 *
 * Pure function of the voucher's status and its settle/refund flags, so the
 * state machine that decides which buttons to show is unit-testable without
 * a wallet, a network or a DOM. `VoucherRow` renders exactly this list:
 * getting it wrong offers a button the contract will reject.
 */
export function availableActions(
  status: VoucherStatus,
  flags: { isSettleable: boolean; isRefundable: boolean },
  requested: VoucherAction[],
): VoucherAction[] {
  return requested.filter((a) => {
    switch (a) {
      case 'claim':
        return status === 'Funded';
      case 'attest':
        return status === 'Claimed';
      case 'settle':
        return flags.isSettleable;
      case 'refund':
        return flags.isRefundable;
      case 'dispute':
        return status === 'Claimed' || status === 'Attested';
      default:
        return false;
    }
  });
}
