import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { ATTESTER, CLAIMED_VOUCHER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/** Attester flow: a claimed voucher is confirmed as delivered. */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, ATTESTER);
  await mockBackend(page, {
    vouchers: [CLAIMED_VOUCHER('22')],
    // Indexer catches up to the attestation a few polls in (#9).
    voucherConverges: { status: 'Attested' },
  });
});

test('attester confirms care delivered', async ({ page }) => {
  await page.goto('/attest');

  await expect(page.getByText('Awaiting confirmation')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm care delivered' }).click();

  // Attesting pays the clinic after the dispute window, so it confirms in a modal.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Done.')).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'attest',
  });
});
