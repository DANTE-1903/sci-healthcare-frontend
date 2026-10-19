import type { VoucherStatus } from './api';

/** Contract writes the UI can perform from a voucher row. */
export type WriteAction = 'claim' | 'attest' | 'settle' | 'refund' | 'dispute';

/**
 * The status the indexer should converge to after each successful write.
 * The chain is authoritative; the indexer trails it by a few seconds.
 */
export const EXPECTED_STATUS: Record<WriteAction, VoucherStatus> = {
  claim: 'Claimed',
  attest: 'Attested',
  settle: 'Settled',
  refund: 'Refunded',
  dispute: 'Disputed',
};

export type PollOutcome = 'matched' | 'timeout';

function sleep(ms: number, signal?: AbortSignal): Promise<'slept' | 'aborted'> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve('aborted');
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve('slept');
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve('aborted');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Poll the voucher until the indexer reports the expected status (#9).
 *
 * Reads through `read` with exponential backoff (so a slow indexer is not
 * hammered) and gives up after `timeoutMs`. A read that throws — the
 * indexer 500ing while it catches up — counts as "not yet", not as a
 * failure: the transaction already succeeded on chain, and the timeout path
 * tells the user exactly that. Never resolves a stale status as current:
 * only `'matched'` means the new status was observed.
 */
export async function pollVoucherStatus(
  read: () => Promise<VoucherStatus>,
  expected: VoucherStatus,
  options?: {
    timeoutMs?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    signal?: AbortSignal;
  },
): Promise<PollOutcome> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const baseDelayMs = options?.baseDelayMs ?? 1_000;
  const maxDelayMs = options?.maxDelayMs ?? 5_000;
  const signal = options?.signal;
  const deadline = Date.now() + timeoutMs;

  let attempt = 0;
  for (;;) {
    if (signal?.aborted) return 'timeout';
    try {
      if ((await read()) === expected) return 'matched';
    } catch {
      // Indexer not caught up or erroring; keep polling until the timeout.
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return 'timeout';
    const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
    attempt += 1;
    if ((await sleep(Math.min(backoff, remaining), signal)) === 'aborted') {
      return 'timeout';
    }
  }
}
