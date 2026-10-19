import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAccountSpendableBalance } from './stellar';

describe('getAccountSpendableBalance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a zeroed balance when Horizon omits the native balance entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ balances: [], subentry_count: 3 }),
      }),
    );

    await expect(getAccountSpendableBalance('GTEST')).resolves.toMatchObject({
      rawBalance: 0,
      minBalance: 2.5,
      spendable: 0,
      isLowForFees: true,
    });
  });

  it('ignores malformed balance strings instead of crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [{ asset_type: 'native', balance: 'not-a-number' }],
          subentry_count: 0,
        }),
      }),
    );

    await expect(getAccountSpendableBalance('GTEST')).resolves.toMatchObject({
      rawBalance: 0,
      minBalance: 1,
      spendable: 0,
      isLowForFees: true,
    });
  });
});
