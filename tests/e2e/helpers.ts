import type { Page } from '@playwright/test';

import type { MockRpcCall } from '@/lib/e2e-seam';

/**
 * Shared Playwright helpers for end-to-end flow tests.
 *
 * - `useMockWallet` installs the mock wallet (an address, no keys) and the
 *   RPC recorder from src/lib/e2e-seam.ts. The app then behaves as if that
 *   wallet is connected and every contract call succeeds on mock chain.
 * - `mockBackend` serves the read API from in-memory fixtures. List queries
 *   return `vouchers` whatever the filter is; single-entity routes resolve
 *   from `provider` / `voucherById`.
 * - `mockInvokes` returns the recorded contract writes for assertions.
 */

declare global {
  interface Window {
    __SCI_MOCK_WALLET__?: { address: string };
    __SCI_MOCK_RPC__?: { calls: MockRpcCall[]; args: string[][]; delayMs?: number };
  }
}

/**
 * `delayMs` keeps mocked writes in flight for that long, so a test can
 * observe the unload guard during a pending transaction.
 */
export async function useMockWallet(
  page: Page,
  address: string,
  delayMs = 0,
): Promise<void> {
  await page.addInitScript(
    `window.__SCI_MOCK_WALLET__ = { address: '${address}' };
     window.__SCI_MOCK_RPC__ = { calls: [], args: [], delayMs: ${delayMs} };`,
  );
  // The analytics script tag is present in the test build; keep the request
  // itself inside the sandbox. (The analytics spec stubs window.plausible,
  // which is unaffected by this.)
  await page.route('https://plausible.io/**', (route) => route.abort());
}

export type BackendState = {
  provider?: Record<string, unknown>;
  /** Several providers at once, e.g. for the map's located/unlocated split. */
  providers?: Record<string, unknown>[];
  vouchers?: Record<string, unknown>[];
  voucherById?: Record<string, unknown>;
  /**
   * Per-voucher event log (`GET /vouchers/:id/events`, #18). An id left
   * out answers 404, exactly like an indexer that predates backend #13 —
   * the page then shows the timeline without transaction links.
   */
  /**
   * Indexer convergence (#9). After this many reads of `GET /vouchers/:id`,
   * the mock reports the voucher with `status`, simulating the indexer
   * catching up to a write (default: the 3rd read, ~3s into the backoff
   * poll). Earlier reads serve the fixture state, so write flows can assert
   * the pending state first and the new status after.
   */
  voucherConverges?: { status: string; afterReads?: number };
  voucherEventsById?: Record<string, unknown[]>;
  dailyStats?: Record<string, unknown>;
  attesters?: Record<string, unknown>[];
  receipts?: { total: number; totalSpendDisplay: string; receipts: Record<string, unknown>[] };
};

export async function mockBackend(page: Page, state: BackendState): Promise<void> {
  const providers = state.providers ?? (state.provider ? [state.provider] : []);
  const readsByVoucher = new Map<string, number>();
  await page.route('http://localhost:8080/**', (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/').filter(Boolean);
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (parts[0] === 'stats') {
      if (parts[1] === 'daily') {
        return json(
          state.dailyStats ?? {
            days: 30,
            from: '2026-05-16T00:00:00.000Z',
            to: '2026-06-15T00:00:00.000Z',
            series: [
              {
                date: '2026-06-01',
                funded: { count: 4, amount: '120000000' },
                settled: { count: 2, amount: '60000000' },
                refunded: { count: 0, amount: '0' },
              },
            ],
          },
        );
      }
      return json({
        providers: providers.length,
        activeProviders: providers.length,
        vouchers: state.vouchers?.length ?? 0,
        settledVouchers: 0,
        settledValue: '0',
        receipts: 0,
      });
    }

    if (parts[0] === 'attesters') {
      const attesters = state.attesters ?? [
        {
          address: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAA',
          active: true,
          addedAt: '2026-01-15T10:00:00.000Z',
          removedAt: null,
          attestations: 14,
          name: 'Red Cross Clinical Inspector',
          organisation: 'International Medical Verification',
        },
      ];
      return json({
        total: attesters.length,
        limit: 50,
        offset: 0,
        attesters,
      });
    }

    if (parts[0] === 'receipts') {
      return json(
        state.receipts ?? { total: 0, totalSpendDisplay: '0.00', receipts: [] },
      );
    }

    if (parts[0] === 'providers') {
      if (parts.length === 2) {
        const found = providers.find(
          (p) => (p as { address?: string }).address === parts[1],
        );
        if (found) return json(found);
        return json({ message: 'Not found' }, 404);
      }
      return json({ total: providers.length, providers });
    }

    if (parts[0] === 'vouchers') {
      // /vouchers/<id>/events — per-step transaction hashes (#18).
      if (parts.length === 3 && parts[2] === 'events') {
        const events = state.voucherEventsById?.[parts[1]];
        if (events) return json({ total: events.length, events });
        return json({ message: 'Not found' }, 404);
      }
      if (parts.length === 2) {
        const converge = state.voucherConverges;
        if (converge) {
          const seen = (readsByVoucher.get(parts[1]) ?? 0) + 1;
          readsByVoucher.set(parts[1], seen);
          if (seen > (converge.afterReads ?? 2)) {
            const raw =
              state.voucherById?.[parts[1]] ??
              state.vouchers?.find((cand) => String(cand.id) === parts[1]);
            if (raw && typeof raw === 'object') {
              return json({ ...(raw as Record<string, unknown>), status: converge.status });
            }
          }
        }
        const v = state.voucherById?.[parts[1]];
        if (v) return json(v);
        return json({ message: 'Not found' }, 404);
      }
      return json({ total: state.vouchers?.length ?? 0, vouchers: state.vouchers ?? [] });
    }

    return route.continue();
  });
}

/** Contract writes recorded by the RPC mock, in call order. */
export async function mockInvokes(page: Page): Promise<MockRpcCall[]> {
  const calls = await page.evaluate(() => window.__SCI_MOCK_RPC__?.calls ?? []);
  return calls.filter((c) => c.kind === 'invoke');
}

/**
 * The arguments of those writes, as base64 XDR, in the same order: index `i`
 * here is what `mockInvokes(page)[i]` carried. Lets a test assert a value the
 * UI never shows — that the date a funder picked became the `expires_at` the
 * contract was called with, for instance.
 */
export async function mockInvokeArgs(page: Page): Promise<string[][]> {
  return page.evaluate(() => {
    const mock = window.__SCI_MOCK_RPC__;
    if (!mock) return [];
    return mock.calls
      .map((call, i) => (call.kind === 'invoke' ? mock.args[i] ?? [] : null))
      .filter((args): args is string[] => args !== null);
  });
}
