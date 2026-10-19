import { describe, expect, it } from 'vitest';

import { DISPUTE_REASONS, disputeReasonLabel } from './disputes';

/**
 * Dispute reason codes (#77) are a shared convention between the app, the
 * indexer and whoever resolves disputes: `docs/protocol/lifecycle.md` says add
 * codes, never renumber. A changed number here would relabel every historical
 * dispute, so the mapping is pinned.
 */
describe('disputeReasonLabel', () => {
  it('maps every documented code to its label', () => {
    expect(disputeReasonLabel(1)).toBe('The patient was not seen');
    expect(disputeReasonLabel(2)).toBe('Care was not delivered as described');
    expect(disputeReasonLabel(3)).toBe('A different service was provided');
    expect(disputeReasonLabel(4)).toBe('Something else');
  });

  it('returns null when no reason was recorded', () => {
    expect(disputeReasonLabel(null)).toBeNull();
    expect(disputeReasonLabel(undefined)).toBeNull();
  });

  it('degrades to a readable fallback for an unknown code', () => {
    expect(disputeReasonLabel(99)).toBe('Reason #99');
    expect(disputeReasonLabel(0)).toBe('Reason #0');
  });

  it('supports locale translations', () => {
    expect(disputeReasonLabel(1, 'fr')).toBe("Le patient n'a pas été vu");
    expect(disputeReasonLabel(1, 'sw')).toBe('Mgonjwa hakuonekana');
    expect(disputeReasonLabel(99, 'fr')).toBe('Motif #99');
    expect(disputeReasonLabel(99, 'sw')).toBe('Sababu #99');
  });

  it('keeps the code numbers stable and unique', () => {
    const codes = DISPUTE_REASONS.map((r) => r.code);
    expect(codes).toEqual([1, 2, 3, 4]);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
