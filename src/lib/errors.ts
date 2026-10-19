import { config } from './config';

/**
 * Contract error codes, mirrored from the Rust `#[contracterror]` enums.
 *
 * Keeping these in step with the contracts is manual. If a code is added
 * there and not here the UI degrades to "Error #N" rather than lying, which
 * is the intended failure mode.
 */
export const VOUCHER_ERRORS: Record<number, string> = {
  1: 'This contract has already been set up.',
  2: 'This contract has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That voucher does not exist.',
  5: 'This clinic is not currently active.',
  6: 'This clinic does not offer that service.',
  7: 'The amount is below the listed price for this service.',
  8: 'The amount must be greater than zero.',
  9: 'The expiry date must be in the future.',
  10: 'This voucher is not in the right state for that action.',
  11: 'This voucher has expired.',
  12: 'This voucher cannot be refunded yet.',
  13: 'The dispute window is still open. Settlement unlocks once it closes.',
  14: 'The dispute window has closed.',
  15: 'That fee is not allowed.',
  16: 'The calculation overflowed.',
  17: 'No admin handover is pending.',
};

export const REGISTRY_ERRORS: Record<number, string> = {
  1: 'This registry has already been set up.',
  2: 'This registry has not been set up yet.',
  3: 'You are not authorised to do that.',
  4: 'That clinic is not registered.',
  5: 'That clinic is already registered.',
  6: 'This clinic is not active yet.',
  7: 'That service is not listed.',
  8: 'The price must be greater than zero.',
  9: 'The country code must be two letters.',
  10: 'A name is required.',
  11: 'No admin handover is pending.',
};

export const FAUCET_ERRORS: Record<number, string> = {
  2: 'The test USDC faucet is not set up on this network.',
  3: 'You are not authorised to do that.',
  4: 'The faucet amount must be greater than zero.',
  5: 'You have already had test USDC today. Try again later.',
};

export const VOUCHER_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: VOUCHER_ERRORS,
  fr: {
    1: 'Ce contrat a déjà été configuré.',
    2: "Ce contrat n'a pas encore été configuré.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: "Ce bon d'achat n'existe pas.",
    5: "Cette clinique n'est pas active actuellement.",
    6: 'Cette clinique ne propose pas ce service.',
    7: 'Le montant est inférieur au prix affiché pour ce service.',
    8: 'Le montant doit être supérieur à zéro.',
    9: "La date d'expiration doit être dans le futur.",
    10: "Ce bon d'achat n'est pas dans le bon état pour cette action.",
    11: "Ce bon d'achat a expiré.",
    12: "Ce bon d'achat ne peut pas encore être remboursé.",
    13: 'La période de contestation est toujours ouverte. Le règlement se débloquera à sa clôture.',
    14: 'La période de contestation est clôturée.',
    15: 'Ces frais ne sont pas autorisés.',
    16: 'Le calcul a dépassé la capacité.',
    17: "Aucun transfert d'administration n'est en attente.",
  },
  sw: {
    1: 'Mkataba huu tayari umewekwa.',
    2: 'Mkataba huu bado haujawekwa.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Vocha hiyo haipo.',
    5: 'Kliniki hii haifanyi kazi kwa sasa.',
    6: 'Kliniki hii haitoi huduma hiyo.',
    7: 'Kiasi kiko chini ya bei iliyoorodheshwa kwa huduma hii.',
    8: 'Kiasi lazima kiwe zaidi ya sifuri.',
    9: 'Tarehe ya mwisho wa matumizi lazima iwe siku zijazo.',
    10: 'Vocha hii haiko katika hali sahihi ya hatua hiyo.',
    11: 'Vocha hii imeisha muda wake.',
    12: 'Vocha hii haiwezi kurejeshwa bado.',
    13: 'Muda wa mzozo bado uko wazi. Malipo hufunguka mara tu unapofungwa.',
    14: 'Muda wa mzozo umefungwa.',
    15: 'Ada hiyo hairuhusiwi.',
    16: 'Hesabu imezidi uwezo.',
    17: 'Hakuna makabidhiano ya usimamizi yanayosubiriwa.',
  },
};

export const REGISTRY_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: REGISTRY_ERRORS,
  fr: {
    1: 'Ce registre a déjà été configuré.',
    2: "Ce registre n'a pas encore été configuré.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: "Cette clinique n'est pas enregistrée.",
    5: 'Cette clinique est déjà enregistrée.',
    6: "Cette clinique n'est pas encore active.",
    7: "Ce service n'est pas répertorié.",
    8: 'Le prix doit être supérieur à zéro.',
    9: 'Le code pays doit comporter deux lettres.',
    10: 'Un nom est requis.',
    11: "Aucun transfert d'administration n'est en attente.",
  },
  sw: {
    1: 'Rejesta hii tayari imewekwa.',
    2: 'Rejesta hii bado haijawekwa.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Kliniki hiyo haijasajiliwa.',
    5: 'Kliniki hiyo tayari imesajiliwa.',
    6: 'Kliniki hii bado haifanyi kazi.',
    7: 'Huduma hiyo haijaorodheshwa.',
    8: 'Bei lazima iwe zaidi ya sifuri.',
    9: 'Msimbo wa nchi lazima uwe na herufi mbili.',
    10: 'Jina linahitajika.',
    11: 'Hakuna makabidhiano ya usimamizi yanayosubiriwa.',
  },
};

export const FAUCET_ERRORS_I18N: Record<string, Record<number, string>> = {
  en: FAUCET_ERRORS,
  fr: {
    2: "Le robinet USDC de test n'est pas configuré sur ce réseau.",
    3: "Vous n'êtes pas autorisé à faire cela.",
    4: 'Le montant du robinet doit être supérieur à zéro.',
    5: "Vous avez déjà reçu des USDC de test aujourd'hui. Réessayez plus tard.",
  },
  sw: {
    2: 'Bomba la majaribio la USDC halijawekwa kwenye mtandao huu.',
    3: 'Huna mamlaka ya kufanya hivyo.',
    4: 'Kiasi cha bomba lazima kiwe zaidi ya sifuri.',
    5: 'Tayari umepokea USDC ya majaribio leo. Jaribu tena baadaye.',
  },
};

/** Pulls `Error(Contract, #N)` out of a Soroban host error string. */
export function contractErrorCode(message: string): number | null {
  const m = /Error\(Contract,\s*#(\d+)\)/.exec(message);
  return m?.[1] ? Number(m[1]) : null;
}

export function humaniseError(
  err: unknown,
  table: Record<number, string> = VOUCHER_ERRORS,
  locale = 'en',
): string {
  const message = err instanceof Error ? err.message : String(err);
  // Token failures surface through our contracts with the token's own error
  // number (a missing trustline is #13, which in the voucher table means
  // something else entirely), so recognise them by text before looking the
  // number up.
  if (/trustline/i.test(message)) {
    if (locale === 'fr') return 'Votre portefeuille nécessite une trustline USDC pour détenir ou envoyer des USDC.';
    if (locale === 'sw') return 'Pochi yako inahitaji trustline ya USDC kabla ya kupokea au kutuma USDC.';
    return 'Your wallet needs a USDC trustline before it can hold or send USDC.';
  }
  if (/insufficient balance|balance is not sufficient|underflow/i.test(message)) {
    if (locale === 'fr') return 'Solde USDC insuffisant dans votre portefeuille.';
    if (locale === 'sw') return 'Huna USDC ya kutosha kwenye pochi yako kwa hili.';
    return 'Not enough USDC in your wallet for this.';
  }
  const code = contractErrorCode(message);
  if (code !== null) {
    let resolvedTable = table;
    if (table === VOUCHER_ERRORS && VOUCHER_ERRORS_I18N[locale]) {
      resolvedTable = VOUCHER_ERRORS_I18N[locale];
    } else if (table === REGISTRY_ERRORS && REGISTRY_ERRORS_I18N[locale]) {
      resolvedTable = REGISTRY_ERRORS_I18N[locale];
    } else if (table === FAUCET_ERRORS && FAUCET_ERRORS_I18N[locale]) {
      resolvedTable = FAUCET_ERRORS_I18N[locale];
    }
    const mapped = resolvedTable[code] ?? table[code];
    if (mapped) return mapped;
    if (locale === 'fr') return `Le contrat a rejeté cette opération (erreur #${code}).`;
    if (locale === 'sw') return `Mkataba umekataa ombi hili (hitilafu #${code}).`;
    return `Contract rejected this (error #${code}).`;
  }
  if (/account not found/i.test(message)) {
    if (config.network === 'testnet') {
      if (locale === 'fr') return "Ce compte n'existe pas encore sur le réseau. Approvisionnez-le d'abord avec Friendbot.";
      if (locale === 'sw') return 'Akaunti hii haipo kwenye mtandao bado. Iwekee fedha kwa Friendbot kwanza.';
      return 'This account does not exist on the network yet. Fund it with Friendbot first.';
    }
    if (locale === 'fr') return "Ce compte n'existe pas encore sur le réseau. Approvisionnez-le d'abord.";
    if (locale === 'sw') return 'Akaunti hii haipo kwenye mtandao bado. Iwekee fedha kwanza.';
    return 'This account does not exist on the network yet. Fund it first.';
  }
  return message;
}
