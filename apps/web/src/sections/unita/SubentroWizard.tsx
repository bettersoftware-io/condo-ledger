import { useState } from "react";
import { fromCents } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { formatItDate } from "../../recompute/dates";
import { uniqueId } from "./UnitaDialogs";

export function SubentroWizard({ open, onOpenChange, unit }: {
  open: boolean; onOpenChange: (o: boolean) => void; unit: UnitRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const allRows = rt.useUnitsTree();
  const residents = (unit?.children ?? []).filter((r) => r.kind === "resident");
  const [outgoingId, setOutgoingId] = useState("");
  const [date, setDate] = useState("");
  const [successor, setSuccessor] = useState("");
  const close = (o: boolean) => { if (!o) { setOutgoingId(""); setDate(""); setSuccessor(""); } onOpenChange(o); };

  const submit = () => {
    if (!periodId || !unit) return;
    const outgoing = residents.find((r) => r.id === outgoingId);
    if (!outgoing) return;
    rt.commands.editUnitRow(periodId, outgoingId, {
      restriction: `fino al ${formatItDate(date)}`,
    });
    const zero = fromCents(0);
    rt.commands.addUnitRow(periodId, unit.id, {
      id: uniqueId("r", successor, allRows), kind: "resident",
      label: `${successor} (PR 100%)`, restriction: `dal ${formatItDate(date)}`,
      saldoPrec: zero, preventivo: zero, consuntivo: zero, totDovuto: zero, versato: zero,
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={close} onSubmit={submit} title="Subentro Condòmino"
      steps={[
        {
          title: "Condòmino uscente",
          validate: () => (!outgoingId ? "Seleziona il condòmino uscente" : !date ? "Inserisci la data di subentro" : null),
          content: (
            <div>
              <SelectField label="Condòmino uscente" value={outgoingId} onChange={setOutgoingId}
                options={[{ value: "", label: "—" }, ...residents.map((r) => ({ value: r.id, label: r.label }))]} />
              <DateField label="Data subentro" value={date} onChange={setDate} />
            </div>
          ),
        },
        {
          title: "Subentrante",
          validate: () => (!successor.trim() ? "Inserisci il nominativo del subentrante" : null),
          content: <TextField label="Nominativo subentrante" value={successor} onChange={setSuccessor} />,
        },
        { title: "Conferma", content: <p>Il subentrante {successor} sostituisce il condòmino uscente dalla data indicata.</p> },
      ]}
    />
  );
}
