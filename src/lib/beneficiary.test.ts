import { describe, expect, it } from 'vitest';

import {
  beneficiaryRef,
  generateKey,
  isValidRef,
  parsePatientBackup,
  serialisePatientBackup,
} from './beneficiary';

/**
 * Beneficiary reference derivation (#8). The digest is what goes on chain,
 * so it must be stable for the same inputs and unguessable without the key.
 * No network calls here: WebCrypto only.
 */

const KEY = 'test-secret-key-0123456789abcdef';

describe('beneficiaryRef', () => {
  it('matches the known HMAC-SHA-256 vector', async () => {
    await expect(beneficiaryRef('patient-001', KEY)).resolves.toBe(
      '13833777cd997fe9b416748083856e2deaf0f8fb979a40553214d4fe15318560',
    );
  });

  it('normalises case and surrounding whitespace', async () => {
    await expect(beneficiaryRef('PATIENT-001 ', KEY)).resolves.toBe(
      '13833777cd997fe9b416748083856e2deaf0f8fb979a40553214d4fe15318560',
    );
  });

  it('is deterministic and key-sensitive', async () => {
    const first = await beneficiaryRef('patient-001', KEY);
    await expect(beneficiaryRef('patient-001', KEY)).resolves.toBe(first);
    const other = await beneficiaryRef(
      'patient-001',
      'a-different-secret-key-0123456789',
    );
    expect(other).not.toBe(first);
    expect(isValidRef(first)).toBe(true);
  });

  it('rejects an empty identifier and a short key', async () => {
    await expect(beneficiaryRef('   ', KEY)).rejects.toThrow(/patient reference/i);
    await expect(beneficiaryRef('patient-001', 'too-short')).rejects.toThrow(
      /32 characters/i,
    );
  });
});

describe('generateKey / isValidRef', () => {
  it('generates a fresh 43-char base64url key each time', () => {
    const a = generateKey();
    const b = generateKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('validates 64-hex digests only', () => {
    expect(isValidRef('0'.repeat(64))).toBe(true);
    expect(isValidRef('0'.repeat(63))).toBe(false);
    expect(isValidRef('z'.repeat(64))).toBe(false);
    expect(isValidRef('')).toBe(false);
  });
});

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

describe('serialisePatientBackup', () => {
  it('round-trips through the importer with nickname, reference and key', async () => {
    const original = { nickname: 'Mum', identifier: 'card-881', key: '0123456789abcdef0123456789abcdef' };
    await expect(parsePatientBackup(serialisePatientBackup(original))).resolves.toEqual(original);
  });

  it('refuses to back up a key that is too short to restore', () => {
    expect(() => serialisePatientBackup({ identifier: 'card-881', key: 'short' })).toThrow(
      'at least 32 characters',
    );
  });
});
