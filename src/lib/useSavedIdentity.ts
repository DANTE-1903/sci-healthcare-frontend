'use client';

import { useSyncExternalStore } from 'react';

import { localIdentity, type SavedPatient } from './beneficiary';

export type SavedIdentity = {
  patients: SavedPatient[];
  selectedNickname: string;
  selectedPatient: SavedPatient | null;
  identifier: string;
  key: string;
};

const EMPTY: SavedIdentity = {
  patients: [],
  selectedNickname: '',
  selectedPatient: null,
  identifier: '',
  key: '',
};
let cached: SavedIdentity = EMPTY;

/** Returns the same object until the stored values change, as React requires. */
function snapshot(): SavedIdentity {
  const store = localIdentity.load();
  const selectedPatient =
    store.patients.find((patient) => patient.nickname === store.selectedNickname) ?? null;
  const next: SavedIdentity = {
    ...store,
    selectedPatient,
    identifier: selectedPatient?.identifier ?? '',
    key: selectedPatient?.key ?? '',
  };
  const patientsChanged =
    next.patients.length !== cached.patients.length ||
    next.patients.some((patient, index) => {
      const previous = cached.patients[index];
      return (
        !previous ||
        patient.nickname !== previous.nickname ||
        patient.identifier !== previous.identifier ||
        patient.key !== previous.key
      );
    });
  if (
    patientsChanged ||
    next.selectedNickname !== cached.selectedNickname ||
    next.identifier !== cached.identifier ||
    next.key !== cached.key
  ) {
    cached = next;
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('sci:saved-patients-changed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('sci:saved-patients-changed', onChange);
  };
}

/**
 * Saved patient references and the currently selected patient on this device.
 *
 * Read through useSyncExternalStore rather than copied into state in an
 * effect: the server render sees nothing saved, the client sees what is in
 * localStorage, and React reconciles the two without a hydration mismatch.
 */
export function useSavedIdentity(): SavedIdentity {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
