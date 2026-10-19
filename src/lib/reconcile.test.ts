import { describe, expect, it, vi } from 'vitest';

import { EXPECTED_STATUS, pollVoucherStatus } from './reconcile';

/**
 * Indexer reconciliation (#9). After a write the chain has moved but the
 * indexer lags, so the UI polls with backoff until the expected status
 * appears. The mocked API below updates after 3 polls, like the real one.
 */

describe('EXPECTED_STATUS', () => {
  it('maps every write to the status the chain converges to', () => {
    expect(EXPECTED_STATUS).toEqual({
      claim: 'Claimed',
      attest: 'Attested',
      settle: 'Settled',
      refund: 'Refunded',
      dispute: 'Disputed',
    });
  });
});

describe('pollVoucherStatus', () => {
  it('resolves matched once the indexer catches up', async () => {
    let polls = 0;
    const outcome = await pollVoucherStatus(
      () => {
        polls += 1;
        return Promise.resolve(polls >= 3 ? 'Claimed' : 'Funded');
      },
      'Claimed',
      { timeoutMs: 1_000, baseDelayMs: 1 },
    );
    expect(outcome).toBe('matched');
    expect(polls).toBe(3);
  });

  it('resolves timeout when the status never arrives', async () => {
    const outcome = await pollVoucherStatus(() => Promise.resolve('Funded'), 'Claimed', {
      timeoutMs: 20,
      baseDelayMs: 1,
    });
    expect(outcome).toBe('timeout');
  });

  it('treats a failing read as not-yet, not as failure', async () => {
    let polls = 0;
    const outcome = await pollVoucherStatus(
      () => {
        polls += 1;
        if (polls < 2) return Promise.reject(new Error('indexer catching up'));
        return Promise.resolve('Settled');
      },
      'Settled',
      { timeoutMs: 1_000, baseDelayMs: 1 },
    );
    expect(outcome).toBe('matched');
    expect(polls).toBe(2);
  });

  it('backs off between polls instead of hammering', async () => {
    const requested: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    const spy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
        requested.push(ms ?? 0);
        return realSetTimeout(cb, 0, ...rest);
      }) as typeof setTimeout);
    try {
      // NB: the loop runs until the wall-clock deadline, so the timeout
      // must stay well under the 5s test timeout even with 0ms sleeps.
      await expect(
        pollVoucherStatus(() => Promise.resolve('Funded'), 'Claimed', {
          timeoutMs: 800,
          baseDelayMs: 100,
          maxDelayMs: 1_000,
        }),
      ).resolves.toBe('timeout');
    } finally {
      spy.mockRestore();
    }
    expect(requested.length).toBeGreaterThan(3);
    expect(requested.slice(0, 3)).toEqual([100, 200, 400]);
    expect(Math.max(...requested)).toBeLessThanOrEqual(1_000);
  });

  it('stops early when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollVoucherStatus(() => Promise.resolve('Funded'), 'Claimed', {
        signal: controller.signal,
      }),
    ).resolves.toBe('timeout');
  });
});
