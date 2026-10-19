import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLAIMED_VOUCHER, FUNDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Funder flow: a claimed voucher is disputed with a reason code.
 * Disputing takes two clicks — the test drives both.
 */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    vouchers: [CLAIMED_VOUCHER('23')],
    // Indexer catches up to the dispute a few polls in (#9).
    voucherConverges: { status: 'Disputed' },
  });
});

test('funder disputes a claimed voucher', async ({ page }) => {
  await page.goto('/my');

  await expect(page.getByText('Vouchers I funded')).toBeVisible();
  await page.getByRole('button', { name: 'Dispute' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByLabel('What went wrong?')
    .selectOption({ label: 'A different service was provided' });
  await page.getByRole('dialog').getByRole('button', { name: 'Open dispute' }).click();

  await expect(page.getByText('Done.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'dispute',
  });
});
