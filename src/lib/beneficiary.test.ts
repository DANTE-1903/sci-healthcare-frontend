import { describe, expect, it } from 'vitest';

import { parsePatientBackup } from './beneficiary';

describe('parsePatientBackup', () => {
  it('accepts a valid JSON backup object', async () => {
    const patient = await parsePatientBackup({
      identifier: 'patient-123',
      key: '0123456789abcdef0123456789abcdef',
    });

    expect(patient.identifier).toBe('patient-123');
    expect(patient.key).toBe('0123456789abcdef0123456789abcdef');
  });

  it('accepts a JSON string backup', async () => {
    const patient = await parsePatientBackup(
      JSON.stringify({
        patient: {
          identifier: 'relative-spot-check',
          key: 'abcdefghijklmnopqrstuvwxzy1234567890',
        },
      }),
    );

    expect(patient.identifier).toBe('relative-spot-check');
    expect(patient.key).toBe('abcdefghijklmnopqrstuvwxzy1234567890');
  });

  it('keeps the nickname from a backup made by this app', async () => {
    const patient = await parsePatientBackup({
      nickname: 'Mum',
      identifier: 'card-881',
      key: '0123456789abcdef0123456789abcdef',
    });
    expect(patient).toEqual({
      nickname: 'Mum',
      identifier: 'card-881',
      key: '0123456789abcdef0123456789abcdef',
    });
  });

  it('lists a backup without a nickname under its patient reference', async () => {
    const patient = await parsePatientBackup('card-881 | 0123456789abcdef0123456789abcdef');
    expect(patient.nickname).toBe('card-881');
  });

  it('rejects a corrupted backup with a clear error', async () => {
    await expect(
      parsePatientBackup(JSON.stringify({ identifier: 'patient-123', key: 'too-short' })),
    ).rejects.toThrow('at least 32 characters');
  });
});
