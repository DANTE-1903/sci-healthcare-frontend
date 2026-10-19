/**
 * Dispute reason codes.
 *
 * The voucher contract stores `reason_code` as an opaque u32 and emits it
 * in `voucher_disputed`; it attaches no meaning to it. These codes are the
 * convention the app, the indexer and whoever resolves disputes share, and
 * are documented in docs/protocol/lifecycle.md. Add codes, never renumber.
 */
export const DISPUTE_REASONS = [
  { code: 1, label: 'The patient was not seen' },
  { code: 2, label: 'Care was not delivered as described' },
  { code: 3, label: 'A different service was provided' },
  { code: 4, label: 'Something else' },
] as const;

export const DISPUTE_REASONS_I18N: Record<string, Record<number, string>> = {
  en: {
    1: 'The patient was not seen',
    2: 'Care was not delivered as described',
    3: 'A different service was provided',
    4: 'Something else',
  },
  fr: {
    1: "Le patient n'a pas été vu",
    2: "Les soins n'ont pas été dispensés comme prévu",
    3: 'Un service différent a été fourni',
    4: 'Autre motif',
  },
  sw: {
    1: 'Mgonjwa hakuonekana',
    2: 'Huduma haikutolewa kama ilivyoelezwa',
    3: 'Huduma tofauti ilitolewa',
    4: 'Kitu kingine',
  },
};

export type DisputeReasonCode = (typeof DISPUTE_REASONS)[number]['code'];

export function disputeReasonLabel(
  code: number | null | undefined,
  locale = 'en',
): string | null {
  if (code === null || code === undefined) return null;
  const table = DISPUTE_REASONS_I18N[locale] ?? DISPUTE_REASONS_I18N.en;
  if (table && table[code]) {
    return table[code];
  }
  const fallback = DISPUTE_REASONS.find((r) => r.code === code)?.label;
  if (fallback) return fallback;
  return locale === 'fr'
    ? `Motif #${code}`
    : locale === 'sw'
      ? `Sababu #${code}`
      : `Reason #${code}`;
}
