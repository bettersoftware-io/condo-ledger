import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { LedgerAccountRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField, MoneyField, CheckboxField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

export function AccountDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: LedgerAccountRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const accounts = rt.useLedgerAccountsTree();
  const tables = rt.useDistributionTables();
  const groups = flattenRows(accounts).filter((r) => r.kind === "grouping")
    .map((r) => ({ value: r.id, label: r.label }));

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"regular" | "grouping">("regular");
  const [parentId, setParentId] = useState("");
  const [isExpense, setIsExpense] = useState(false);
  const [tableName, setTableName] = useState("");
  const [preventivoCents, setPreventivoCents] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? "");
    setKind(editing?.kind === "grouping" ? "grouping" : "regular");
    setParentId("");
    setIsExpense(editing ? editing.rd === "R" : false);
    setTableName(editing?.tabelle ?? "");
    setPreventivoCents(editing?.preventivo?.cents ?? 0);
  }, [open, editing]);

  const submit = () => {
    if (!periodId) return;
    const expense = isExpense
      ? { rd: "R" as const, tabelle: tableName, preventivo: fromCents(preventivoCents) }
      : { rd: undefined, tabelle: undefined, preventivo: null };
    if (editing) {
      rt.commands.editAccountRow(periodId, editing.id, { label, ...expense });
    } else {
      const slug = `acc-${label.toLowerCase().replace(/\W+/g, "-")}`;
      const taken = new Set(flattenRows(accounts).map((r) => r.id));
      let id = slug;
      for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
      const zero = fromCents(0);
      rt.commands.addAccountRow(periodId, parentId || null, {
        id,
        kind, label, dare: zero, avere: zero, saldo: zero,
        preventivo: isExpense ? fromCents(preventivoCents) : null,
        ...(isExpense ? { rd: "R" as const, tabelle: tableName } : {}),
      });
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange}
      title={editing ? "Modifica Conto" : "Aggiungi Conto"} onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Dati conto",
        validate: () =>
          !label.trim() ? "Inserisci il nome del conto"
          : !editing && !parentId ? "Seleziona il raggruppamento padre"
          : isExpense && !tableName ? "Seleziona la tabella di riparto" : null,
        content: (
          <div>
            <TextField label="Nome conto" value={label} onChange={setLabel} />
            {!editing && (
              <>
                <SelectField label="Tipo conto" value={kind} onChange={(v) => setKind(v as "regular" | "grouping")}
                  options={[{ value: "regular", label: "Movimentabile" }, { value: "grouping", label: "Raggruppamento" }]} />
                <SelectField label="Raggruppamento padre" value={parentId} onChange={setParentId}
                  options={[{ value: "", label: "—" }, ...groups]} />
              </>
            )}
            {kind === "regular" && (
              <>
                <CheckboxField label="Conto di spesa (ripartito)" checked={isExpense} onChange={setIsExpense} />
                {isExpense && (
                  <>
                    <SelectField label="Tabella di riparto" value={tableName} onChange={setTableName}
                      options={[{ value: "", label: "—" }, ...tables.map((t) => ({ value: t.name, label: t.name }))]} />
                    <MoneyField label="Preventivo" cents={preventivoCents} onChange={setPreventivoCents} />
                  </>
                )}
              </>
            )}
          </div>
        ),
      }]}
    />
  );
}
