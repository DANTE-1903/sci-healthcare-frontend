import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { FUNDER, REFUNDABLE_VOUCHER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/** Funder flow: an expired, unclaimed voucher is refunded. */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    vouchers: [REFUNDABLE_VOUCHER('24')],
    // Indexer catches up to the refund a few polls in (#9).
    voucherConverges: { status: 'Refunded' },
  });
});

test('funder is refunded for an unused voucher', async ({ page }) => {
  await page.goto('/my');

  await expect(page.getByText('Vouchers I funded')).toBeVisible();
  await page.getByRole('button', { name: 'Refund me' }).click();

  await expect(page.getByText('Done.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'refund',
  });
});
