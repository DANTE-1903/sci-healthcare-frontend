'use client';

import { useCallback, useState } from 'react';

import { localIdentity, type SavedPatient } from '@/lib/beneficiary';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { Alert, Button, Modal } from '@/components/ui';

export function SavedPatientControls({
  identifier,
  keyValue,
  onSelect,
}: {
  identifier: string;
  keyValue: string;
  onSelect: (patient: SavedPatient | null) => void;
}) {
  const saved = useSavedIdentity();
  const [saveName, setSaveName] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const closeManager = useCallback(() => setManaging(false), []);
  const nickname = saveName ?? saved.selectedPatient?.nickname ?? '';

  function selectPatient(nicknameValue: string) {
    const patient = saved.patients.find((item) => item.nickname === nicknameValue) ?? null;
    setMessage(null);
    setSaveName(patient?.nickname ?? '');
    localIdentity.select(patient?.nickname ?? '');
    onSelect(patient);
  }

  function savePatient() {
    setMessage(null);
    if (!nickname.trim()) {
      setMessage('Enter a nickname for this patient.');
      return;
    }
    if (!identifier.trim() || keyValue.length < 32) {
      setMessage('Enter a patient reference and a key of at least 32 characters.');
      return;
    }
    if (!localIdentity.save(nickname, identifier, keyValue)) {
      setMessage('Could not save in this browser. Check that browser storage is available.');
      return;
    }
    setSaveName(nickname.trim());
  }

  function renamePatient(patient: SavedPatient) {
    const nextNickname = renameDraft.trim();
    setMessage(null);
    if (!nextNickname) {
      setMessage('Enter a nickname.');
      return;
    }
    const duplicate = saved.patients.some(
      (item) =>
        item.nickname !== patient.nickname &&
        item.nickname.toLowerCase() === nextNickname.toLowerCase(),
    );
    if (duplicate) {
      setMessage('That nickname is already in use.');
      return;
    }
    if (!localIdentity.rename(patient.nickname, nextNickname)) {
      setMessage('Could not rename this patient. Check that browser storage is available.');
      return;
    }
    if (saved.selectedNickname === patient.nickname) {
      onSelect({ ...patient, nickname: nextNickname });
      setSaveName(nextNickname);
    }
    setEditingNickname(null);
  }

  function deletePatient(patient: SavedPatient) {
    setMessage(null);
    if (!localIdentity.remove(patient.nickname)) {
      setMessage('Could not delete this patient. Check that browser storage is available.');
      return;
    }
    if (saved.selectedNickname === patient.nickname) {
      const next = localIdentity.load();
      const selected = next.patients.find((item) => item.nickname === next.selectedNickname) ?? null;
      onSelect(selected);
      setSaveName(selected?.nickname ?? '');
    }
    if (editingNickname === patient.nickname) setEditingNickname(null);
  }

  return (
    <div className="space-y-3 border-b border-[var(--color-line)] pb-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="block min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            Saved patients
          </span>
          <select
            aria-label="Saved patients"
            value={saved.selectedNickname}
            onChange={(event) => selectPatient(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <option value="">Choose a saved patient</option>
            {saved.patients.map((patient) => (
              <option key={patient.nickname} value={patient.nickname}>
                {patient.nickname}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          className="self-end whitespace-nowrap"
          onClick={() => {
            setMessage(null);
            setManaging(true);
          }}
        >
          Manage
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            Save patient as
          </span>
          <input
            aria-label="Patient nickname"
            value={nickname}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="e.g. Mum"
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
        </label>
        <Button variant="ghost" className="whitespace-nowrap" onClick={savePatient}>
          Save patient
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
        Saved references and keys stay in this browser only and are never sent to the
        service. Anyone with access to this browser profile can use them.
      </p>
      {message && <Alert>{message}</Alert>}

      <Modal
        open={managing}
        onClose={closeManager}
        title="Manage saved patients"
        actions={
          <Button variant="ghost" onClick={closeManager}>
            Done
          </Button>
        }
      >
        <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
          Patient references and keys are not shown here.
        </p>
        {saved.patients.length === 0 ? (
          <p className="py-2 text-sm text-[var(--color-ink-soft)]">No saved patients.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {saved.patients.map((patient) => (
              <li key={patient.nickname} className="py-3">
                {editingNickname === patient.nickname ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-xs text-[var(--color-ink-soft)]">New nickname</span>
                      <input
                        aria-label="New nickname"
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button onClick={() => renamePatient(patient)}>Save name</Button>
                      <Button
                        variant="ghost"
                        onClick={() => setEditingNickname(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{patient.nickname}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="px-3"
                        onClick={() => {
                          setMessage(null);
                          setEditingNickname(patient.nickname);
                          setRenameDraft(patient.nickname);
                        }}
                      >
                        Rename {patient.nickname}
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3"
                        onClick={() => deletePatient(patient)}
                      >
                        Delete {patient.nickname}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}