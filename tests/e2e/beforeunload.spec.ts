import { expect, test, type Page } from '@playwright/test';

import { CLINIC, FUNDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Leaving during a pending transaction.
 *
 * The guard registers a real `beforeunload` listener only while a write is
 * in flight. Rather than relying on a browser dialog (which headless
 * Chromium may suppress unless a navigation is in progress), the test
 * dispatches a cancelable `beforeunload` event and checks whether the guard
 * cancelled it — which is exactly what makes a browser ask before leaving.
 *
 * The mock RPC holds the write open (delayMs) so the pending state is
 * observable.
 */

async function beforeUnloadPrevented(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

test.beforeEach(async ({ page }) => {
  await useMockWallet(page, FUNDER, 2000);
  await mockBackend(page, { provider: CLINIC });
});

test('warns before unload only while a transaction is pending', async ({ page }) => {
  await page.goto(`/clinics/${CLINIC.address}`);
  await expect(page.getByText('Fund care')).toBeVisible();

  // Nothing in flight: no warning.
  expect(await beforeUnloadPrevented(page)).toBe(false);

  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));
  await page.getByRole('button', { name: 'Fund voucher' }).click();
  // Funding now goes through a review step (#22).
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  // While the write is in flight, the unload is cancelled (browser warns).
  await expect
    .poll(() => beforeUnloadPrevented(page), { timeout: 1500 })
    .toBe(true);

  // Once it settles, ordinary navigation is not interrupted again.
  await expect
    .poll(() => beforeUnloadPrevented(page), { timeout: 6000 })
    .toBe(false);
});
