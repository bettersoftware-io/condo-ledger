import { useEffect, useState } from "react";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, CheckboxField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { formatItDate } from "../../recompute/dates";

export function EditInstallmentDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const { columns } = rt.useInstallments();
  const [colId, setColId] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => { if (open) { setColId(""); setName(""); setExpiry(""); setLocked(false); } }, [open]);
  const pick = (id: string) => {
    setColId(id);
    const col = columns.find((c) => c.id === id);
    setName(col?.header ?? ""); setExpiry(col?.expiry ?? ""); setLocked(col?.locked ?? false);
  };

  const submit = () => {
    if (!periodId || !colId) return;
    const header = expiry ? `${name.replace(/\s*\(.*\)$/, "")} (${formatItDate(expiry)})` : name;
    rt.commands.editInstallment(periodId, colId, { header, expiry: expiry || undefined, locked });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Modifica Rata" onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Rata",
        validate: () => (!colId ? "Seleziona la rata" : !name.trim() ? "Inserisci il nome" : null),
        content: (
          <div>
            <SelectField label="Rata" value={colId} onChange={pick}
              options={[{ value: "", label: "—" }, ...columns.map((c) => ({ value: c.id, label: c.header }))]} />
            <CheckboxField label="Bloccata" checked={locked} onChange={setLocked} />
            <TextField label="Nome" value={name} onChange={setName} disabled={locked} />
            <DateField label="Scadenza" value={expiry} onChange={setExpiry} disabled={locked} />
          </div>
        ),
      }]}
    />
  );
}
