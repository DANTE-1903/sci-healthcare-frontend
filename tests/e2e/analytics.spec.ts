import { expect, test, type Page } from '@playwright/test';

import { CLAIMED_VOUCHER, CLINIC, FUNDED_VOUCHER, FUNDER, PROVIDER } from './fixtures';
import { mockBackend, useMockWallet } from './helpers';

/**
 * Privacy: analytics must never carry identifiers.
 *
 * The Plausible script request itself is blocked (see useMockWallet) while
 * `window.plausible` is stubbed to record what the app *would* send. Every
 * assertion below scans the full payload: pageviews must use normalized
 * routes and funnel events must be names without properties.
 */

declare global {
  interface Window {
    plausible?: (...args: unknown[]) => void;
    __sciAnalyticsEvents?: unknown[][];
  }
}

async function recordAnalytics(page: Page): Promise<void> {
  await page.addInitScript(`
    window.plausible = function (...args) {
      (window.__sciAnalyticsEvents ??= []).push(args);
    };
  `);
}

async function analyticsEvents(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => window.__sciAnalyticsEvents ?? []);
}

async function pageviewUrls(page: Page): Promise<string[]> {
  const events = await analyticsEvents(page);
  return events
    .filter((e) => e[0] === 'pageview')
    .map((e) => (e[1] as { u: string }).u);
}

/** Polls until the current page has recorded exactly the expected pageviews. */
async function expectPageviews(page: Page, urls: string[]): Promise<void> {
  await expect
    .poll(() => pageviewUrls(page), { timeout: 10000 })
    .toEqual(urls);
}

/** Nothing identifying may appear in any recorded payload. */
function expectNoIdentifiers(events: unknown[][], secrets: string[]): void {
  const blob = JSON.stringify(events);
  for (const secret of secrets) expect(blob).not.toContain(secret);
  expect(blob).not.toMatch(/[0-9a-f]{64}/);
}

test('pageviews use normalized routes, never identifiers', async ({ page }) => {
  await recordAnalytics(page);
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    provider: CLINIC,
    voucherById: { 7: CLAIMED_VOUCHER('7') },
  });

  // The recorder resets on every navigation, so each page is asserted
  // before moving on.
  await page.goto('/');
  await expectPageviews(page, ['http://127.0.0.1:3100/']);
  expectNoIdentifiers(await analyticsEvents(page), [FUNDER, PROVIDER]);

  await page.goto(`/clinics/${PROVIDER}`);
  await expect(page.getByText('Fund care')).toBeVisible();
  await expectPageviews(page, ['http://127.0.0.1:3100/clinics/[address]']);
  expectNoIdentifiers(await analyticsEvents(page), [FUNDER, PROVIDER]);

  await page.goto('/vouchers/7');
  await expect(page.getByText('History')).toBeVisible();
  await expectPageviews(page, ['http://127.0.0.1:3100/vouchers/[id]']);
  expectNoIdentifiers(await analyticsEvents(page), [FUNDER, PROVIDER]);
});

test('funding records a prop-less event', async ({ page }) => {
  await recordAnalytics(page);
  await useMockWallet(page, FUNDER);
  await mockBackend(page, {
    provider: CLINIC,
    voucherById: { 7: CLAIMED_VOUCHER('7') },
  });

  await page.goto(`/clinics/${CLINIC.address}`);
  await page.getByPlaceholder('e.g. clinic card number').fill('CARD-123');
  await page.getByPlaceholder('stays on this device').fill('s'.repeat(32));
  await page.getByRole('button', { name: 'Fund voucher' }).click();
  // Funding now goes through a review step (#22).
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Voucher funded.')).toBeVisible();

  const events = await analyticsEvents(page);
  expect(events).toContainEqual(['voucher_funded']);
  expectNoIdentifiers(events, [FUNDER, PROVIDER, 'CARD-123', '30000000']);
  for (const e of events) {
    if (e[0] === 'pageview') continue;
    expect(e).toHaveLength(1);
  }
});

test('claiming records a prop-less event', async ({ page }) => {
  await recordAnalytics(page);
  await useMockWallet(page, PROVIDER);
  await mockBackend(page, {
    provider: CLINIC,
    vouchers: [FUNDED_VOUCHER('31')],
  });

  await page.goto('/clinic');
  await page.getByRole('button', { name: 'Mark patient seen' }).click();
  await expect(page.getByText('Done.')).toBeVisible();

  const events = await analyticsEvents(page);
  expect(events).toContainEqual(['voucher_claimed']);
  expectNoIdentifiers(events, [FUNDER, PROVIDER]);
  for (const e of events) {
    if (e[0] === 'pageview') continue;
    expect(e).toHaveLength(1);
  }
});
