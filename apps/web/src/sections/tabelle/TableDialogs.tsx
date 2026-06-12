import { useEffect, useState } from "react";
import type { DistributionTable } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

export function TableDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: DistributionTable | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const tables = rt.useDistributionTables();
  const [name, setName] = useState("");
  const [total, setTotal] = useState("1000");
  useEffect(() => {
    if (open) { setName(editing?.name ?? ""); setTotal(String(editing?.total ?? 1000)); }
  }, [open, editing]);

  const submit = () => {
    if (!periodId) return;
    const tot = Number(total);
    if (editing) {
      rt.commands.editTable(periodId, editing.id, { name, total: tot });
    } else {
      const slug = `t-${name.toLowerCase().replace(/\W+/g, "-")}`;
      const taken = new Set(tables.map((t) => t.id));
      let id = slug;
      for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
      rt.commands.addTable(periodId, {
        id, name, restriction: null, total: tot, items: [],
      });
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Tabella" : "Aggiungi Tabella"}
      steps={[{
        title: "Tabella",
        validate: () => {
          const tot = Number(total);
          if (!name.trim()) return "Inserisci il nome";
          if (Number.isNaN(tot) || tot <= 0) return "Totale non valido";
          return null;
        },
        content: (
          <div>
            <TextField label="Nome tabella" value={name} onChange={setName} />
            <TextField label="Totale (millesimi)" value={total} onChange={setTotal} type="number" />
          </div>
        ),
      }]}
    />
  );
}

export function AddItemDialog({ open, onOpenChange, tableId }: {
  open: boolean; onOpenChange: (o: boolean) => void; tableId: string | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const tables = rt.useDistributionTables();
  const table = tables.find((t) => t.id === tableId) ?? null;
  const units = flattenRows(rt.useUnitsTree()).filter((u) => u.kind === "unit");
  const [unitId, setUnitId] = useState("");
  const [coefficient, setCoefficient] = useState("0");
  useEffect(() => { if (open) { setUnitId(""); setCoefficient("0"); } }, [open]);

  const submit = () => {
    if (!periodId || !tableId) return;
    rt.commands.addTableItem(periodId, tableId, {
      unitId, unitLabel: units.find((u) => u.id === unitId)?.label ?? unitId,
      coefficient: Number(coefficient.replace(",", ".")), competenza: "intero",
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title="Aggiungi Coefficiente"
      steps={[{
        title: "Riga",
        validate: () =>
          !unitId ? "Seleziona l'unità"
          : table?.items.some((i) => i.unitId === unitId) ? "Unità già presente nella tabella"
          : Number.isNaN(Number(coefficient.replace(",", "."))) ? "Coefficiente non valido" : null,
        content: (
          <div>
            <SelectField label="Unità" value={unitId} onChange={setUnitId}
              options={[{ value: "", label: "—" }, ...units.map((u) => ({ value: u.id, label: u.label }))]} />
            <TextField label="Coefficiente" value={coefficient} onChange={setCoefficient} />
          </div>
        ),
      }]}
    />
  );
}
