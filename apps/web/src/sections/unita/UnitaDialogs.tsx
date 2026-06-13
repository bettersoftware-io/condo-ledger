import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

const zeroMoney = () => {
  const zero = fromCents(0);
  return { saldoPrec: zero, preventivo: zero, consuntivo: zero, totDovuto: zero, versato: zero };
};

/** slug + -2/-3… suffix against every id in the tree (established id-uniqueness pattern) */
export function uniqueId(prefix: string, label: string, rows: UnitRow[]): string {
  const slug = `${prefix}-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const taken = new Set(flattenRows(rows).map((r) => r.id));
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
  return id;
}

export function UnitDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: UnitRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const allRows = rt.useUnitsTree();
  const groups = flattenRows(allRows).filter((r) => r.kind === "group")
    .map((r) => ({ value: r.id, label: r.label }));
  const [label, setLabel] = useState("");
  const [unitType, setUnitType] = useState("Appartamento");
  const [floor, setFloor] = useState("");
  const [inner, setInner] = useState("");
  const [sub, setSub] = useState("");
  const [parentId, setParentId] = useState("");
  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? ""); setUnitType(editing?.unitType ?? "Appartamento");
    setFloor(editing?.floor ?? ""); setInner(editing?.inner ?? ""); setSub(editing?.sub ?? "");
    setParentId(groups[0]?.value ?? "");
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!periodId) return;
    const fields = { label, unitType, floor, inner, sub };
    if (editing) rt.commands.editUnitRow(periodId, editing.id, fields);
    else rt.commands.addUnitRow(periodId, parentId || null, {
      id: uniqueId("u", label, allRows), kind: "unit", ...fields, ...zeroMoney(),
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Unità" : "Aggiungi Unità"}
      steps={[{
        title: "Unità",
        validate: () => (!label.trim() ? "Inserisci il nome dell'unità" : !editing && !parentId ? "Seleziona il gruppo" : null),
        content: (
          <div>
            <TextField label="Nome unità" value={label} onChange={setLabel} />
            <SelectField label="Tipo" value={unitType} onChange={setUnitType}
              options={["Appartamento", "Box", "Cantina", "Negozio"].map((t) => ({ value: t, label: t }))} />
            <TextField label="Piano" value={floor} onChange={setFloor} />
            <TextField label="Interno" value={inner} onChange={setInner} />
            <TextField label="Subalterno" value={sub} onChange={setSub} />
            {!editing && <SelectField label="Gruppo" value={parentId} onChange={setParentId} options={groups} />}
          </div>
        ),
      }]}
    />
  );
}

export function GroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const allRows = rt.useUnitsTree();
  const [label, setLabel] = useState("");
  useEffect(() => { if (open) setLabel(""); }, [open]);
  const submit = () => {
    if (!periodId) return;
    rt.commands.addUnitRow(periodId, null, {
      id: uniqueId("g", label, allRows), kind: "group", label, ...zeroMoney(), children: [],
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Gruppo"
      steps={[{
        title: "Gruppo",
        validate: () => (!label.trim() ? "Inserisci il nome del gruppo" : null),
        content: <TextField label="Nome gruppo" value={label} onChange={setLabel} />,
      }]}
    />
  );
}

export function ResidentDialog({ open, onOpenChange, unitId }: {
  open: boolean; onOpenChange: (o: boolean) => void; unitId: string | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const allRows = rt.useUnitsTree();
  const [name, setName] = useState("");
  const [role, setRole] = useState("PR");
  const [percent, setPercent] = useState("100");
  useEffect(() => { if (open) { setName(""); setRole("PR"); setPercent("100"); } }, [open]);
  const submit = () => {
    if (!periodId || !unitId) return;
    rt.commands.addUnitRow(periodId, unitId, {
      id: uniqueId("r", name, allRows), kind: "resident",
      label: `${name} (${role} ${percent}%)`, ...zeroMoney(),
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Condòmino"
      steps={[{
        title: "Condòmino",
        validate: () =>
          !name.trim() ? "Inserisci il nominativo"
          : Number.isNaN(Number(percent)) || Number(percent) <= 0 || Number(percent) > 100 ? "Percentuale non valida" : null,
        content: (
          <div>
            <TextField label="Nominativo" value={name} onChange={setName} />
            <SelectField label="Ruolo" value={role} onChange={setRole}
              options={[{ value: "PR", label: "Proprietario" }, { value: "IN", label: "Inquilino" }, { value: "US", label: "Usufruttuario" }]} />
            <TextField label="Percentuale" value={percent} onChange={setPercent} type="number" />
          </div>
        ),
      }]}
    />
  );
}
