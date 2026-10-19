import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLAIMED_VOUCHER, CLINIC, FUNDER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * Funder flow: pick a service, fund a voucher, follow the link to it.
 *
 * Exercises the funding form end to end — beneficiary-ref derivation, the
 * mocked fee quote, create_voucher and the cross-page link — without
 * touching testnet.
 */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    provider: CLINIC,
    voucherById: { 7: CLAIMED_VOUCHER('7') },
  });
});

test('fund a voucher for a clinic service', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC.address}`);

  await expect(page.getByRole('button', { name: 'Fund voucher' })).toBeVisible();
  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));

  // Fee quote comes back through the mocked readContract.
  await expect(page.getByText(/Clinic receives \$3\.00/)).toBeVisible();

  await page.getByRole('button', { name: 'Fund voucher' }).click();

  // Funding now goes through a review step (#22).

  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(page.getByText('Voucher funded.')).toBeVisible();
  const link = page.getByRole('link', { name: 'Open voucher #7' });
  await expect(link).toBeVisible();
  expect(await mockInvokes(page)).toContainEqual({
    kind: 'invoke',
    contractId: E2E_CONTRACTS.voucher,
    method: 'create_voucher',
  });

  // The new voucher's page loads from the mocked API.
  await link.click();
  await expect(page.getByText('History')).toBeVisible();
  await expect(page.getByText('Outpatient consult').first()).toBeVisible();
});
