import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDED_VOUCHER, PROVIDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/** Clinic flow: an incoming funded voucher is claimed as patient seen. */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, PROVIDER);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [FUNDED_VOUCHER('21')],
    // Indexer catches up to the claim a few polls in (#9).
    voucherConverges: { status: 'Claimed' },
  });
});

test('clinic marks the patient seen', async ({ page }) => {
  await page.goto('/clinic');

  await expect(page.getByText('This clinic is verified')).toBeVisible();
  await page.getByRole('button', { name: 'Mark patient seen' }).click();

  await expect(page.getByText('Done.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'claim',
  });
});
