import { describe, expect, it } from 'vitest';
import { extractVoucherId } from '@/components/QrScannerModal';

describe('extractVoucherId', () => {
  it('extracts plain number or alphanumeric id', () => {
    expect(extractVoucherId('42')).toBe('42');
    expect(extractVoucherId('#42')).toBe('42');
    expect(extractVoucherId('vch-abc-123')).toBe('vch-abc-123');
  });

  it('extracts voucher id from full URL', () => {
    expect(extractVoucherId('https://sci-healthcare.org/vouchers/42')).toBe('42');
    expect(extractVoucherId('http://localhost:3000/vouchers/105?contract=C123')).toBe('105');
    expect(extractVoucherId('/vouchers/999')).toBe('999');
  });

  it('extracts voucher id from JSON payload', () => {
    expect(extractVoucherId('{"id":"42","contract":"C123"}')).toBe('42');
    expect(extractVoucherId('{"voucherId":"88"}')).toBe('88');
    expect(extractVoucherId('{"id":"#55"}')).toBe('55');
  });

  it('returns null for empty or invalid input', () => {
    expect(extractVoucherId('')).toBeNull();
    expect(extractVoucherId('   ')).toBeNull();
    expect(extractVoucherId('invalid input with spaces')).toBeNull();
  });
});
