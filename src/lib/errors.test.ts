import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  contractErrorCode,
  FAUCET_ERRORS,
  humaniseError,
  REGISTRY_ERRORS,
  VOUCHER_ERRORS,
} from './errors';

/**
 * Contract error mapping (#77). A user should see "the dispute window is still
 * open", never `Error(Contract, #13)`. The lookup order matters too: token
 * errors arrive with the token's own numbers, so they are recognised by text
 * before the voucher table is consulted.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('contractErrorCode', () => {
  it('pulls the number out of a host error string', () => {
    expect(contractErrorCode('Error(Contract, #13)')).toBe(13);
    expect(contractErrorCode('HostError: Error(Contract, #1)')).toBe(1);
    expect(contractErrorCode('Error(Contract, #0)')).toBe(0);
  });

  it('returns null when there is no contract error', () => {
    expect(contractErrorCode('something broke')).toBeNull();
    expect(contractErrorCode('Error(Contract)')).toBeNull();
  });
});

describe('humaniseError', () => {
  it('maps a voucher error number to plain language', () => {
    expect(humaniseError(new Error('Error(Contract, #13)'))).toBe(
      'The dispute window is still open. Settlement unlocks once it closes.',
    );
    expect(humaniseError('Error(Contract, #4)')).toBe('That voucher does not exist.');
  });

  it('uses the table it is given', () => {
    expect(humaniseError(new Error('Error(Contract, #4)'), REGISTRY_ERRORS)).toBe(
      'That clinic is not registered.',
    );
    expect(humaniseError(new Error('Error(Contract, #5)'), FAUCET_ERRORS)).toBe(
      'You have already had test USDC today. Try again later.',
    );
  });

  it('reports an unmapped code without pretending to know it', () => {
    expect(humaniseError(new Error('Error(Contract, #999)'))).toBe(
      'Contract rejected this (error #999).',
    );
  });

  it('recognises token failures before the voucher table', () => {
    // A missing trustline is error #13 from the token, which in the voucher
    // table means the dispute window; it must not be reported as that.
    expect(humaniseError(new Error('token trustline missing'))).toBe(
      'Your wallet needs a USDC trustline before it can hold or send USDC.',
    );
    expect(humaniseError(new Error('insufficient balance for transfer'))).toBe(
      'Not enough USDC in your wallet for this.',
    );
    expect(humaniseError(new Error('balance is not sufficient'))).toBe(
      'Not enough USDC in your wallet for this.',
    );
  });

  it('passes through a message it cannot place', () => {
    expect(humaniseError(new Error('the network is down'))).toBe('the network is down');
    expect(humaniseError('the network is down')).toBe('the network is down');
  });

  it('points at Friendbot on testnet and says "fund it" on mainnet', async () => {
    expect(humaniseError(new Error('account not found'))).toMatch(/Friendbot/);

    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'public');
    vi.resetModules();
    const mainnet = await import('./errors');
    const message = mainnet.humaniseError(new Error('account not found'));
    expect(message).not.toMatch(/Friendbot/);
    expect(message).toBe('This account does not exist on the network yet. Fund it first.');
  });

  it('supports French and Swahili translations', () => {
    expect(humaniseError(new Error('Error(Contract, #4)'), VOUCHER_ERRORS, 'fr')).toBe(
      "Ce bon d'achat n'existe pas.",
    );
    expect(humaniseError(new Error('Error(Contract, #4)'), VOUCHER_ERRORS, 'sw')).toBe(
      'Vocha hiyo haipo.',
    );
    expect(humaniseError(new Error('token trustline missing'), VOUCHER_ERRORS, 'fr')).toBe(
      'Votre portefeuille nécessite une trustline USDC pour détenir ou envoyer des USDC.',
    );
    expect(humaniseError(new Error('token trustline missing'), VOUCHER_ERRORS, 'sw')).toBe(
      'Pochi yako inahitaji trustline ya USDC kabla ya kupokea au kutuma USDC.',
    );
  });
});

describe('error tables', () => {
  it('holds the codes the contracts document', () => {
    expect(VOUCHER_ERRORS[13]).toBe(
      'The dispute window is still open. Settlement unlocks once it closes.',
    );
    expect(REGISTRY_ERRORS[10]).toBe('A name is required.');
    expect(FAUCET_ERRORS[2]).toBe(
      'The test USDC faucet is not set up on this network.',
    );
  });

  it('has no empty messages', () => {
    for (const table of [VOUCHER_ERRORS, REGISTRY_ERRORS, FAUCET_ERRORS]) {
      for (const [code, message] of Object.entries(table)) {
        expect(message, `code ${code}`).toBeTruthy();
      }
    }
  });
});
