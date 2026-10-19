import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { expect, test } from '@playwright/test';

import { E2E_CONTRACTS } from './contracts';
import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, mockInvokeArgs, mockInvokes, useMockWallet } from './helpers';

/**
 * Funder flow: choose an exact expiry date instead of a preset window (#26).
 *
 * The date the funder picks has to reach `create_voucher` as that day's
 * `expires_at`, and the picker may only offer dates the contract accepts:
 * anything strictly in the future, so today (UTC) onwards with no upper
 * bound. The assertion reads the encoded contract arguments rather than the
 * form's own copy, so it cannot pass on a rendering that never gets sent.
 */

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER);
  await mockBackend(page, { provider: CLINIC });
});

/** The `YYYY-MM-DD` a date input holds: `days` from now, in UTC. */
function dateInputValue(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

test('a custom expiry date becomes the voucher expiry', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC.address}`);

  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));

  await page.getByLabel('Patient must attend within').selectOption('custom');

  const dateInput = page.getByLabel('Expiry date');
  await expect(dateInput).toBeVisible();
  // The contract rejects an `expires_at` that is not in the future, so the
  // earliest date the picker offers is today in UTC — and no later bound at
  // all, because the contract has none.
  await expect(dateInput).toHaveAttribute('min', dateInputValue(0));
  await expect(dateInput).not.toHaveAttribute('max');

  const chosen = dateInputValue(45);
  await dateInput.fill(chosen);
  await expect(page.getByText(/refundable after the end of/)).toBeVisible();

  await page.getByRole('button', { name: 'Fund voucher' }).click();
  // Funding now goes through a review step (#22).
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Voucher funded.')).toBeVisible();

  const writes = await mockInvokes(page);
  const args = await mockInvokeArgs(page);
  const created = writes.findIndex(
    (call) =>
      call.contractId === E2E_CONTRACTS.voucher && call.method === 'create_voucher',
  );
  expect(created).toBeGreaterThanOrEqual(0);
  // create_voucher(funder, beneficiary_ref, provider, service_code, amount, expires_at)
  const encodedExpiry = args[created][5];
  const expiresAt = Number(scValToNative(xdr.ScVal.fromXDR(encodedExpiry, 'base64')));
  // End of the chosen day, UTC: the voucher is valid through that date.
  expect(expiresAt).toBe(Math.floor(Date.parse(`${chosen}T23:59:59Z`) / 1000));
});

test('a custom date without a day chosen is refused before signing', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC.address}`);

  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));

  await page.getByLabel('Patient must attend within').selectOption('custom');
  await page.getByRole('button', { name: 'Fund voucher' }).click();
  // Funding now goes through a review step (#22).
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(
    page.getByText('Choose the date the patient must attend by.'),
  ).toBeVisible();
  expect(await mockInvokes(page)).toHaveLength(0);
});
