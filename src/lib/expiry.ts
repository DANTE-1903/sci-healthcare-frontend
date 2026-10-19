/**
 * How long a funder gives the patient to attend, and how a chosen calendar
 * date becomes a voucher's `expires_at`.
 *
 * The voucher contract's only rule is that `expires_at` must be strictly
 * greater than the current ledger time; anything else comes back as
 * `InvalidExpiry` (#9) and it sets no latest date. The helpers below apply
 * exactly that rule and nothing more, so the picker offers the same dates
 * the contract will accept: today (UTC) onwards, with no upper bound.
 */

/** Preset windows, in days, offered alongside a custom date. */
export const EXPIRY_OPTIONS = [14, 30, 60, 90] as const;

export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];

/** What the funder picked: a preset window, or a specific calendar date. */
export type ExpiryChoice = ExpiryOption | 'custom';

export const SECONDS_PER_DAY = 24 * 60 * 60;

/** The value a `<input type="date">` reads and writes: `YYYY-MM-DD`. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The contract's lower bound, as a date input value: today in UTC.
 *
 * An earlier date could never be accepted (its last second is already
 * gone), and today can always be, so this is the earliest date the picker
 * may offer.
 */
export function minExpiryDate(nowMs: number = Date.now()): string {
  return toDateInputValue(new Date(nowMs));
}

/** `now + days`, as the unix seconds the contract takes. */
export function expiresAtFromDays(days: ExpiryOption, nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) + days * SECONDS_PER_DAY;
}

/**
 * A calendar date as the unix seconds the contract takes: the last second of
 * that day, UTC.
 *
 * End of day rather than midnight because the voucher is valid *through* the
 * date the funder picks — a funder choosing the day of the appointment
 * expects the clinic to be able to claim it that day. Returns null for
 * anything that is not a real `YYYY-MM-DD` date.
 */
export function expiresAtFromDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day, 23, 59, 59);
  const parsed = new Date(ms);
  // Date.UTC rolls 31 February over into March, so compare it back.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(ms / 1000);
}

/**
 * The `expires_at` for a choice, in unix seconds, or null while a custom
 * date has not been filled in (or is not a real date).
 */
export function expiresAtFor(
  choice: ExpiryChoice,
  customDate: string,
  nowMs: number = Date.now(),
): number | null {
  if (choice === 'custom') return expiresAtFromDate(customDate);
  return expiresAtFromDays(choice, nowMs);
}
