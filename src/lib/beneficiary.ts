/**
 * Beneficiary references, computed in the browser.
 *
 * The chain must never see a patient identifier, so the identifier is
 * HMAC'd under a key the patient (or their clinic) holds and only the
 * 32-byte digest is submitted. The key never leaves this device: it is not
 * sent to the API and not written to the ledger.
 *
 * This is pseudonymity, not anonymity. Someone who already knows both the
 * identifier and the key can confirm a match; someone with only on-chain
 * data cannot enumerate patients, because HMAC without the key is not
 * searchable.
 */
export async function beneficiaryRef(identifier: string, key: string): Promise<string> {
  const id = identifier.trim().toLowerCase();
  if (!id) throw new Error('Enter a patient reference');
  if (key.length < 32) throw new Error('The secret key must be at least 32 characters');

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(id));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A fresh random key for deriving beneficiary references: 32 bytes from
 * the browser's CSPRNG, base64url-encoded to 43 characters.
 *
 * Whoever funds care for a patient needs the same key again to look up
 * that patient's history, so the UI must tell them to keep it.
 */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function isValidRef(ref: string): boolean {
  return /^[0-9a-f]{64}$/.test(ref);
}

export type SavedPatient = { nickname: string; identifier: string; key: string };

/**
 * Reads a patient backup: a file or text holding JSON (the app's own backup
 * format and a few common shapes), or "reference | key" on one line. The
 * result is a saved patient ready for `localIdentity.save`.
 */
function normalisePatientValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function parseMaybeJson(data: string): unknown {
  const trimmed = data.trim();
  if (!trimmed) throw new Error('The patient backup is empty.');
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

function parseSavedPatientRecord(value: unknown): SavedPatient {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) throw new Error('The patient backup is empty.');

    const parsed = parseMaybeJson(cleaned);
    if (parsed !== cleaned) return parseSavedPatientRecord(parsed);

    const [idPart, keyPart] = cleaned.split(/\s*\|\s*|\r?\n/).map((part) => part.trim());
    if (idPart && keyPart) {
      return { nickname: idPart, identifier: idPart, key: keyPart };
    }

    throw new Error('The backup must be a JSON object with an identifier and key.');
  }

  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error('This patient backup is empty.');
    return parseSavedPatientRecord(value[0]);
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('The backup must contain a patient identifier and key.');
  }

  const record = value as Record<string, unknown>;
  const nested =
    record.patient ??
    record.identity ??
    record.savedPatient ??
    record.data ??
    record.record ??
    record;

  const identifier = normalisePatientValue(
    (nested as Record<string, unknown>).identifier ??
      (nested as Record<string, unknown>).patientId ??
      (nested as Record<string, unknown>).patientIdentifier ??
      (nested as Record<string, unknown>).reference ??
      (nested as Record<string, unknown>).patient_ref ??
      record.identifier ??
      record.patientId ??
      record.patientIdentifier ??
      record.reference,
  );

  const key = normalisePatientValue(
    (nested as Record<string, unknown>).key ??
      (nested as Record<string, unknown>).secretKey ??
      (nested as Record<string, unknown>).patientKey ??
      (nested as Record<string, unknown>).secret ??
      record.key ??
      record.secretKey ??
      record.patientKey ??
      record.secret,
  );

  if (!identifier) throw new Error('This backup is missing a patient reference.');
  if (!key) throw new Error('This backup is missing a patient key.');
  if (key.length < 32) throw new Error('The patient key must be at least 32 characters long.');

  // Backups made by this app carry a nickname; anything else is listed under
  // its patient reference, which only ever lives on this device.
  const nickname =
    normalisePatientValue(
      (nested as Record<string, unknown>).nickname ?? record.nickname ?? record.name,
    ) || identifier;
  return { nickname, identifier, key };
}

export async function parsePatientBackup(input: string | File | unknown): Promise<SavedPatient> {
  if (input instanceof File) {
    return parseSavedPatientRecord(await input.text());
  }
  if (typeof input === 'string') {
    return parseSavedPatientRecord(parseMaybeJson(input));
  }
  return parseSavedPatientRecord(input);
}

type SavedPatientStore = { patients: SavedPatient[]; selectedNickname: string };

const PATIENTS_STORAGE = 'sci:saved-patients';
const SELECTED_STORAGE = 'sci:selected-patient';
const LEGACY_KEY_STORAGE = 'sci:beneficiary-key';
const LEGACY_ID_STORAGE = 'sci:beneficiary-id';
const PATIENTS_CHANGED = 'sci:saved-patients-changed';

function readPatients(value: string | null): SavedPatient[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (patient): patient is SavedPatient =>
        typeof patient?.nickname === 'string' &&
        typeof patient?.identifier === 'string' &&
        typeof patient?.key === 'string',
    );
  } catch {
    return [];
  }
}

function announcePatientsChanged(): void {
  window.dispatchEvent(new Event(PATIENTS_CHANGED));
}

function persist(store: SavedPatientStore): boolean {
  try {
    localStorage.setItem(PATIENTS_STORAGE, JSON.stringify(store.patients));
    if (store.selectedNickname) {
      localStorage.setItem(SELECTED_STORAGE, store.selectedNickname);
    } else {
      localStorage.removeItem(SELECTED_STORAGE);
    }
    announcePatientsChanged();
    return true;
  } catch {
    return false;
  }
}

/** Patient references and keys are persisted only in this browser's storage. */
export const localIdentity = {
  load(): SavedPatientStore {
    if (typeof window === 'undefined') return { patients: [], selectedNickname: '' };
    try {
      const stored = localStorage.getItem(PATIENTS_STORAGE);
      let patients = readPatients(stored);
      if (stored === null) {
        const identifier = localStorage.getItem(LEGACY_ID_STORAGE) ?? '';
        const key = localStorage.getItem(LEGACY_KEY_STORAGE) ?? '';
        if (identifier && key) {
          patients = [{ nickname: 'Saved patient', identifier, key }];
          localStorage.setItem(PATIENTS_STORAGE, JSON.stringify(patients));
          localStorage.removeItem(LEGACY_ID_STORAGE);
          localStorage.removeItem(LEGACY_KEY_STORAGE);
        }
      }
      const requested = localStorage.getItem(SELECTED_STORAGE) ?? '';
      const selectedNickname = patients.some((patient) => patient.nickname === requested)
        ? requested
        : patients.at(-1)?.nickname ?? '';
      return { patients, selectedNickname };
    } catch {
      return { patients: [], selectedNickname: '' };
    }
  },
  save(nickname: string, identifier: string, key: string): boolean {
    const cleanNickname = nickname.trim();
    if (!cleanNickname) return false;
    const { patients } = this.load();
    const existing = patients.findIndex(
      (patient) => patient.nickname.toLowerCase() === cleanNickname.toLowerCase(),
    );
    const patient = { nickname: cleanNickname, identifier, key };
    const next = [...patients];
    if (existing >= 0) next[existing] = patient;
    else next.push(patient);
    return persist({ patients: next, selectedNickname: cleanNickname });
  },
  select(nickname: string): boolean {
    const { patients } = this.load();
    if (nickname && !patients.some((patient) => patient.nickname === nickname)) return false;
    return persist({ patients, selectedNickname: nickname });
  },
  rename(currentNickname: string, newNickname: string): boolean {
    const cleanNickname = newNickname.trim();
    if (!cleanNickname) return false;
    const { patients, selectedNickname } = this.load();
    if (
      patients.some(
        (patient) =>
          patient.nickname !== currentNickname &&
          patient.nickname.toLowerCase() === cleanNickname.toLowerCase(),
      )
    ) {
      return false;
    }
    const next = patients.map((patient) =>
      patient.nickname === currentNickname
        ? { ...patient, nickname: cleanNickname }
        : patient,
    );
    if (!next.some((patient) => patient.nickname === cleanNickname)) return false;
    return persist({
      patients: next,
      selectedNickname: selectedNickname === currentNickname ? cleanNickname : selectedNickname,
    });
  },
  remove(nickname: string): boolean {
    const { patients, selectedNickname } = this.load();
    const next = patients.filter((patient) => patient.nickname !== nickname);
    if (next.length === patients.length) return false;
    const nextSelected = selectedNickname === nickname ? next.at(-1)?.nickname ?? '' : selectedNickname;
    return persist({ patients: next, selectedNickname: nextSelected });
  },
};
