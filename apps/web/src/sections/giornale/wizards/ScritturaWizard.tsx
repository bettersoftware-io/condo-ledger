import { useState } from "react";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { TextField, DateField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, accountLabel } from "./accountOptions";
import { EntriesForm, validateEntries, type EntryDraft } from "./EntriesForm";

const EMPTY: EntryDraft[] = [
  { accountId: "", dareCents: 0, avereCents: 0 },
  { accountId: "", dareCents: 0, avereCents: 0 },
];

export function ScritturaWizard({ open, onOpenChange, mode }: {
  open: boolean; onOpenChange: (o: boolean) => void; mode: "scrittura" | "saldi";
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const options = accountOptions(rt.useLedgerAccountsTree());

  const [date, setDate] = useState("");
  const [description, setDescription] = useState(mode === "saldi" ? "Apertura saldi iniziali" : "");
  const [partita, setPartita] = useState("");
  const [entries, setEntries] = useState<EntryDraft[]>(EMPTY);

  const reset = () => { setDate(""); setDescription(mode === "saldi" ? "Apertura saldi iniziali" : ""); setPartita(""); setEntries(EMPTY); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const submit = () => {
    if (!periodId) return;
    const input = {
      date, description, partita: partita || undefined,
      entries: entries.map((e) => ({
        accountId: e.accountId, label: accountLabel(options, e.accountId),
        dareCents: e.dareCents, avereCents: e.avereCents,
      })),
    };
    try {
      if (mode === "saldi") rt.commands.openBalances(periodId, input);
      else rt.commands.addTransaction(periodId, input);
      toast("Scrittura registrata");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Errore");
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={close}
      title={mode === "saldi" ? "Apertura Saldi Iniziali" : "Scrittura Contabile"}
      onSubmit={submit}
      steps={[
        {
          title: "Dati scrittura",
          validate: () => (!date ? "Inserisci la data" : !description ? "Inserisci la descrizione" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <TextField label="Descrizione" value={description} onChange={setDescription} />
              <TextField label="Partita" value={partita} onChange={setPartita} />
            </div>
          ),
        },
        {
          title: "Righe Dare/Avere",
          validate: () => validateEntries(entries),
          content: <EntriesForm entries={entries} onChange={setEntries} options={options} />,
        },
        {
          title: "Conferma",
          content: (
            <div>
              <p>{date} — {description}</p>
              <ul>
                {entries.map((e, i) => (
                  <li key={i}>{accountLabel(options, e.accountId)}: D {e.dareCents / 100} / A {e.avereCents / 100}</li>
                ))}
              </ul>
            </div>
          ),
        },
      ]}
    />
  );
}
