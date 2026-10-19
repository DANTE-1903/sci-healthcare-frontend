import { expect, test } from '@playwright/test';

import { blockAnalytics } from '../analytics-guard';
import { CLAIMED_VOUCHER, CLINIC, FUNDER, FUNDED_VOUCHER } from './fixtures';
import { mockBackend, mockInvokes, useMockWallet } from './helpers';

/**
 * UI polish from the Wave batch (#78 copy buttons, #79 names for addresses,
 * #80 toast notifications). The unit-tested helpers behind these live in
 * src/lib and run under Vitest, not here.
 */

test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
});

const notifications = (page: import('@playwright/test').Page) =>
  page.locator('[aria-label="Notifications"]');

test.describe('Copy buttons for addresses and hashes (#78)', () => {
  test('copies the full funder address, not the shortened form', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const voucher = FUNDED_VOUCHER('781');
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [voucher],
      voucherById: { '781': voucher },
    });

    await page.goto('/vouchers/781');
    await expect(page.getByText('Funded by')).toBeVisible();

    // The shortened form is what is shown, but the clipboard gets the full
    // value so it can be pasted into an explorer.
    await expect(page.getByText('GCFIRY…XVYOJR')).toBeVisible();
    await page.getByRole('button', { name: 'Copy funder address' }).click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(FUNDER);
    // Announced to screen readers through a live region.
    await expect(page.getByText('funder address copied')).toBeAttached();
  });

  test('copies the full patient reference hash', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const voucher = FUNDED_VOUCHER('782');
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [voucher],
      voucherById: { '782': voucher },
    });

    await page.goto('/vouchers/782');
    await page.getByRole('button', { name: 'Copy patient reference' }).click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      voucher.beneficiaryRef,
    );
  });

  test('copies the clinic address from the clinic page', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockBackend(page, { provider: CLINIC });

    await page.goto(`/clinics/${CLINIC.address}`);
    await expect(page.getByRole('button', { name: 'Copy clinic address' })).toBeVisible();
    await page.getByRole('button', { name: 'Copy clinic address' }).click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CLINIC.address);
  });
});

test.describe('Names instead of raw addresses (#79)', () => {
  test('shows a known funder name, with the address on hover', async ({ page }) => {
    // The funder is itself a registered clinic, so its name is in the
    // directory the page has loaded.
    const funderClinic = { ...CLINIC, address: FUNDER, name: 'Funders Community Clinic' };
    const voucher = FUNDED_VOUCHER('791');
    await mockBackend(page, {
      providers: [CLINIC, funderClinic],
      vouchers: [voucher],
      voucherById: { '791': voucher },
    });

    await page.goto('/vouchers/791');

    const fundedBy = page.locator(`span[title="${FUNDER}"]`).first();
    await expect(fundedBy).toHaveText('Funders Community Clinic');
  });

  test('falls back to the shortened address when the funder is unknown', async ({ page }) => {
    const voucher = FUNDED_VOUCHER('792');
    await mockBackend(page, {
      provider: CLINIC,
      vouchers: [voucher],
      voucherById: { '792': voucher },
    });

    await page.goto('/vouchers/792');
    await expect(page.locator(`span[title="${FUNDER}"]`).first()).toHaveText(
      'GCFIRY…XVYOJR',
    );
  });

  test('voucher lists show the clinic name with its address on hover', async ({ page }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC, vouchers: [CLAIMED_VOUCHER('793')] });

    await page.goto('/my');
    await expect(
      page.locator(`span[title="${CLINIC.address}"]`).first(),
    ).toHaveText('Ikeja General Clinic');
  });
});

test.describe('Toast notifications for transaction results (#80)', () => {
  test('announces a successful transaction in the notification live region', async ({ page }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, {
      vouchers: [CLAIMED_VOUCHER('801')],
      voucherById: { '801': CLAIMED_VOUCHER('801') },
    });

    await page.goto('/my');
    await page.getByRole('button', { name: 'Dispute' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Open dispute' }).click();

    const region = notifications(page);
    await expect(region).toContainText('Done.');
    await expect(region.getByRole('link', { name: 'View transaction' })).toBeVisible();

    // Dismissible, and it clears itself.
    await region.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(page.getByText('Done.')).toHaveCount(0);
  });

  test('shows a failed action as an error toast without prompting the wallet', async ({ page }) => {
    await useMockWallet(page, FUNDER);
    await mockBackend(page, { provider: CLINIC });

    await page.goto(`/clinics/${CLINIC.address}`);
    // No patient reference, so the local validation rejects it before any
    // transaction is built or simulated.
    await page.getByRole('button', { name: 'Fund voucher' }).click();
    // Funding now goes through a review step (#22).
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(notifications(page)).toContainText('Enter a patient reference');
    expect(await mockInvokes(page)).toEqual([]);
  });
});
