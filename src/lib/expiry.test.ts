import { describe, expect, it } from 'vitest';

import {
  EXPIRY_OPTIONS,
  expiresAtFor,
  expiresAtFromDate,
  expiresAtFromDays,
  minExpiryDate,
} from './expiry';

/**
 * A custom expiry date (#26) is only right if it lands inside the bounds the
 * voucher contract enforces: `create_voucher` rejects an `expires_at` that is
 * not strictly in the future (`InvalidExpiry`, #9) and sets no latest date.
 * These pin both halves of that — the earliest date the picker may offer, and
 * the `expires_at` a chosen date becomes — so a change to either is a change
 * to what the contract will accept.
 */
describe('EXPIRY_OPTIONS', () => {
  it('keeps the preset windows the funding form offers', () => {
    expect([...EXPIRY_OPTIONS]).toEqual([14, 30, 60, 90]);
  });
});

describe('minExpiryDate', () => {
  it('is today in UTC, whatever time of day it is', () => {
    expect(minExpiryDate(Date.UTC(2026, 9, 18, 0, 0, 0))).toBe('2026-10-18');
    expect(minExpiryDate(Date.UTC(2026, 9, 18, 23, 59, 59))).toBe('2026-10-18');
  });

  it('rolls over with the UTC day', () => {
    expect(minExpiryDate(Date.UTC(2026, 9, 19, 0, 0, 0))).toBe('2026-10-19');
  });
});

describe('expiresAtFromDays', () => {
  it('counts the preset window from now', () => {
    const now = Date.UTC(2026, 9, 18, 12, 0, 0);
    expect(expiresAtFromDays(14, now)).toBe(Math.floor(now / 1000) + 14 * 86_400);
    expect(expiresAtFromDays(90, now)).toBe(Math.floor(now / 1000) + 90 * 86_400);
  });
});

describe('expiresAtFromDate', () => {
  it('resolves a chosen date to the last second of that day, UTC', () => {
    expect(expiresAtFromDate('2026-12-24')).toBe(
      Date.UTC(2026, 11, 24, 23, 59, 59) / 1000,
    );
  });

  it('leaves the voucher valid through the whole day it names', () => {
    const expiresAt = expiresAtFromDate('2026-12-24');
    expect(expiresAt).not.toBeNull();
    expect(expiresAt!).toBeGreaterThan(Date.UTC(2026, 11, 24, 0, 0, 0) / 1000);
    expect(expiresAt!).toBeLessThan(Date.UTC(2026, 11, 25, 0, 0, 0) / 1000);
  });

  it('rejects anything that is not a real date', () => {
    expect(expiresAtFromDate('')).toBeNull();
    expect(expiresAtFromDate('24/12/2026')).toBeNull();
    expect(expiresAtFromDate('2026-13-01')).toBeNull();
    expect(expiresAtFromDate('2026-02-30')).toBeNull();
    expect(expiresAtFromDate('2027-02-29')).toBeNull();
  });
});

describe('expiresAtFor', () => {
  it('is null until a custom date is chosen', () => {
    expect(expiresAtFor('custom', '')).toBeNull();
  });

  it('takes a custom date from the date, and a preset from now', () => {
    const now = Date.UTC(2026, 9, 18, 12, 0, 0);
    expect(expiresAtFor('custom', '2026-12-24', now)).toBe(
      Date.UTC(2026, 11, 24, 23, 59, 59) / 1000,
    );
    expect(expiresAtFor(30, '', now)).toBe(Math.floor(now / 1000) + 30 * 86_400);
  });

  it('never offers the contract a date it would refuse', () => {
    // The picker's earliest date is today, and the last second of today is
    // still ahead of every moment within it — including the last one.
    const now = Date.UTC(2026, 9, 18, 23, 59, 58);
    const expiresAt = expiresAtFor('custom', minExpiryDate(now), now);
    expect(expiresAt).not.toBeNull();
    expect(expiresAt!).toBeGreaterThan(Math.floor(now / 1000));
  });
});
