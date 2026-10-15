import { useState } from 'react';
import type { PetCandidate, PetSource } from '@/services/petRepository';

interface Props {
  candidates: PetCandidate[];
  busy: boolean;
  error: string | null;
  onSelect: (source: PetSource) => Promise<void>;
  onCancel: () => void;
}
const labels: Record<PetSource, string> = {
  file: 'Saved desktop progress', 'account-cache': 'Previous account copy', 'shared-cache': 'Previous session copy',
};

export function PetRecoveryDialog({ candidates, busy, error, onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<PetSource | null>(null);
  return <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="pet-recovery-title" className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 text-gray-900 shadow-xl">
      <h2 id="pet-recovery-title" className="text-xl font-bold">Choose the pet progress to keep</h2>
      <p className="my-3 text-sm">Different saved copies were found. A backup of these copies has been kept. Choose the progress to continue with; the previous copies will remain available for recovery.</p>
      <fieldset disabled={busy}>
        <legend className="sr-only">Saved pet copies</legend>
        {candidates.map(({ source, pet }) => <label key={source} className="my-2 flex cursor-pointer gap-3 rounded border p-3">
          <input type="radio" name="pet-copy" checked={selected === source} onChange={() => setSelected(source)} />
          <span><strong>{pet.name} · {pet.type} · Level {pet.level}</strong><br />
            <span className="text-sm">{labels[source]}<br />Health {pet.health} · Happiness {pet.happiness} · Hunger {pet.hunger} · Energy {pet.energy}<br />Experience {pet.experience} · Last interaction: {pet.lastInteraction.toLocaleString()}</span>
          </span>
        </label>)}
      </fieldset>
      {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded border px-4 py-2">Cancel sign-in</button>
        <button type="button" disabled={!selected || busy} onClick={() => { if (selected) void onSelect(selected); }} className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving choice…' : 'Continue with this copy'}</button>
      </div>
    </section>
  </div>;
}
