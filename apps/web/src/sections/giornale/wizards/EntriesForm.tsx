import { fromCents, formatEUR } from "@cl/domain";
import { SelectField, MoneyField } from "../../../components/forms/fields";
import type { AccountOption } from "../../../components/forms/accountOptions";

export interface EntryDraft { accountId: string; dareCents: number; avereCents: number; }

export const entryTotals = (entries: EntryDraft[]) => ({
  dare: entries.reduce((a, e) => a + e.dareCents, 0),
  avere: entries.reduce((a, e) => a + e.avereCents, 0),
});

/** Returns the Italian validation message for a draft entry list, or null when postable. */
export function validateEntries(entries: EntryDraft[]): string | null {
  if (entries.some((e) => !e.accountId)) return "Seleziona un conto per ogni riga";
  const { dare, avere } = entryTotals(entries);
  if (dare !== avere) return "Scrittura non bilanciata: dare ≠ avere";
  if (dare === 0) return "Inserisci almeno un importo";
  return null;
}

export function EntriesForm({ entries, onChange, options }: {
  entries: EntryDraft[]; onChange: (next: EntryDraft[]) => void; options: AccountOption[];
}) {
  const patch = (i: number, p: Partial<EntryDraft>) =>
    onChange(entries.map((e, k) => (k === i ? { ...e, ...p } : e)));
  const { dare, avere } = entryTotals(entries);
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end" }}>
          <SelectField label={`Conto ${i + 1}`} value={e.accountId}
            onChange={(v) => patch(i, { accountId: v })}
            options={[{ value: "", label: "—" }, ...options]} />
          <MoneyField label={`Dare ${i + 1}`} cents={e.dareCents} onChange={(c) => patch(i, { dareCents: c })} />
          <MoneyField label={`Avere ${i + 1}`} cents={e.avereCents} onChange={(c) => patch(i, { avereCents: c })} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { accountId: "", dareCents: 0, avereCents: 0 }])}>
        Aggiungi riga
      </button>
      <p>Totale Dare {formatEUR(fromCents(dare))} — Totale Avere {formatEUR(fromCents(avere))}
        {dare !== avere && <strong> (sbilancio {formatEUR(fromCents(dare - avere))})</strong>}
      </p>
    </div>
  );
}
