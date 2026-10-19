import type { Receipt, Voucher, VoucherEvent } from './api';
import { disputeReasonLabel } from './disputes';

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped';

export type TimelineStep = {
  label: string;
  state: StepState;
  /** When it happened, or when it is due for upcoming steps. */
  at: string | Date | null;
  detail?: string;
  /**
   * Hash of the transaction behind this step, when the indexer has one
   * (#18). Rendered as a "view transaction" link to Stellar Expert, so a
   * reader can verify the step on chain instead of taking the page's word.
   */
  txHash?: string;
};

/**
 * Contract event names that correspond to a timeline step, by step.
 *
 * Names match the typed events published by the voucher contract
 * (`voucher_created`, `voucher_claimed`, …), normalised to snake_case.
 */
export const STEP_EVENT_NAMES = {
  funded: 'voucher_created',
  claimed: 'voucher_claimed',
  attested: 'voucher_attested',
  disputed: 'voucher_disputed',
  resolved: 'dispute_resolved',
  settled: 'voucher_settled',
  refunded: 'voucher_refunded',
} as const;

type StepEventKey = keyof typeof STEP_EVENT_NAMES;

/** Transaction hash per step, keyed by {@link STEP_EVENT_NAMES} key. */
export type StepTxHashes = Partial<Record<StepEventKey, string>>;

/**
 * Maps an indexer event list (`GET /vouchers/:id/events`, backend #13) to
 * transaction hashes per timeline step.
 *
 * Rows arrive in ledger order, so the *last* event with a given name wins:
 * a voucher cannot legitimately repeat an event, but if the log ever does,
 * the most recent transaction is the one that moved the voucher to that
 * step. Malformed rows (no name, no hash) are skipped, and an unavailable
 * endpoint yields an empty map — the timeline then shows dates only, which
 * is the intended fallback (#18).
 */
export function stepTxHashes(events: VoucherEvent[] | null | undefined): StepTxHashes {
  const hashes: StepTxHashes = {};
  for (const event of events ?? []) {
    if (
      !event ||
      typeof event.name !== 'string' ||
      typeof event.txHash !== 'string' ||
      !event.txHash
    )
      continue;
    const name = event.name.trim().toLowerCase();
    const key = (Object.keys(STEP_EVENT_NAMES) as StepEventKey[]).find(
      (k) => STEP_EVENT_NAMES[k] === name,
    );
    if (key) hashes[key] = event.txHash;
  }
  return hashes;
}

/**
 * Turns a voucher's on-chain timestamps into an ordered history.
 *
 * Every timestamp here comes from a contract event, so the timeline is a
 * readable rendering of the ledger, not an app-side record.
 */
export function voucherTimeline(
  v: Voucher,
  receipt: Receipt | null,
  now?: number | Date | null,
  /** Transaction hashes per step from the events endpoint (#18). */
  txHashes?: StepTxHashes | null,
): TimelineStep[] {
  const hash = (key: StepEventKey): string | undefined => txHashes?.[key];
  const refunded = v.status === 'Refunded';
  const disputed = v.status === 'Disputed';
  const currentMs =
    now != null && (typeof now !== 'number' || now > 0)
      ? typeof now === 'number'
        ? now
        : now.getTime()
      : Date.now();

  const steps: TimelineStep[] = [
    {
      label: 'Funded',
      state: 'done',
      at: v.createdAt,
      detail: 'USDC moved into escrow',
      txHash: hash('funded'),
    },
  ];

  steps.push(
    v.claimedAt
      ? {
          label: 'Patient seen',
          state: 'done',
          at: v.claimedAt,
          detail: 'Clinic claimed the voucher',
          txHash: hash('claimed'),
        }
      : {
          label: 'Patient seen',
          state: refunded ? 'skipped' : 'current',
          at: refunded ? null : v.expiresAt,
          detail: refunded ? 'Never claimed' : 'Clinic can claim until the voucher expires',
        },
  );

  if (v.attestedAt) {
    steps.push({
      label: 'Care confirmed',
      state: 'done',
      at: v.attestedAt,
      detail: 'An independent attester confirmed delivery',
      txHash: hash('attested'),
    });
  } else if (v.claimedAt) {
    steps.push({
      label: 'Care confirmed',
      state: refunded || disputed ? 'skipped' : 'current',
      at: null,
      detail: refunded || disputed ? 'Never attested' : 'Waiting for an attester',
    });
  } else {
    steps.push({ label: 'Care confirmed', state: refunded ? 'skipped' : 'upcoming', at: null });
  }

  if (v.disputeDeadline) {
    const closed = new Date(v.disputeDeadline).getTime() <= currentMs;
    steps.push({
      label: 'Dispute window',
      state: closed || v.status !== 'Attested' ? 'done' : 'current',
      at: v.disputeDeadline,
      detail: closed ? 'Closed' : 'The funder can still dispute',
    });
  }

  if (v.disputeOutcome) {
    const isRefundedOutcome = String(v.disputeOutcome).toLowerCase() === 'refunded';
    const resolutionDate =
      v.disputeResolvedAt ?? (isRefundedOutcome ? null : receipt?.settledAt ?? null);
    steps.push({
      label: `Dispute resolved: ${isRefundedOutcome ? 'Refunded' : 'Settled'}`,
      state: 'done',
      at: resolutionDate,
      detail: isRefundedOutcome
        ? 'Resolved in funder’s favour — full amount refunded'
        : 'Resolved in clinic’s favour — care payment released',
      txHash: hash('resolved'),
    });
  }

  if (v.status === 'Settled') {
    steps.push({
      label: 'Clinic paid',
      state: 'done',
      at: receipt?.settledAt ?? null,
      detail: 'Escrow released and a care receipt minted',
      txHash: hash('settled'),
    });
  } else if (refunded) {
    steps.push({
      label: 'Refunded',
      state: 'done',
      at: v.disputeResolvedAt ?? null,
      detail: 'Full amount returned to the funder',
      txHash: hash('refunded'),
    });
  } else if (disputed) {
    steps.push({
      label: 'In dispute',
      state: 'current',
      at: null,
      detail: `${disputeReasonLabel(v.disputeReason) ?? 'Reason not given'}. Awaiting an administrator.`,
      txHash: hash('disputed'),
    });
  } else {
    steps.push({ label: 'Clinic paid', state: 'upcoming', at: null });
  }

  return steps;
}
