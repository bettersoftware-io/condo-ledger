import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { DateField, SelectField, CheckboxField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { flattenRows } from "../../../mock/treeRows";
import { accountOptions, accountLabel } from "../../../components/forms/accountOptions";

/** resident id → its parent unit (residents are direct children of units). */
function unitOfResident(units: UnitRow[], residentId: string): UnitRow | null {
  for (const u of flattenRows(units)) {
    if (u.kind === "unit" && (u.children ?? []).some((r) => r.id === residentId)) return u;
  }
  return null;
}

export function IncassoWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const units = rt.useUnitsTree();
  const installments = rt.useInstallments();
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(rt.useLedgerAccountsTree());

  const residents = flattenRows(units).filter((r) => r.kind === "resident")
    .map((r) => ({ value: r.id, label: r.label }));

  const [date, setDate] = useState("");
  const [residentId, setResidentId] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [liquidAccountId, setLiquidAccountId] = useState("");

  const reset = () => { setDate(""); setResidentId(""); setChecked({}); setLiquidAccountId(""); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const unit = residentId ? unitOfResident(units, residentId) : null;
  const instRow = unit
    ? flattenRows(installments.rows).find((r) => r.kind !== "group" && r.unitId === unit.id) ?? null
    : null;
  const settlements = installments.columns
    .filter((c) => checked[c.id])
    .map((c) => ({ installmentId: c.id, amountCents: instRow?.byInstallment[c.id]?.cents ?? 0 }));
  const total = settlements.reduce((a, s) => a + s.amountCents, 0);
  const liquid = liquidAccountId || functional.liquid || "";

  const submit = (): boolean => {
    if (!periodId || !functional.credit) { toast("Configura il conto funzionale Crediti"); return false; }
    try {
      rt.commands.recordTaking(periodId, {
        date, residentId, residentLabel: residents.find((r) => r.value === residentId)?.label ?? residentId,
        liquidAccountId: liquid, liquidAccountLabel: accountLabel(allOpts, liquid),
        creditAccountId: functional.credit, creditAccountLabel: accountLabel(allOpts, functional.credit),
        settlements,
      });
      toast("Incasso registrato");
      return true;
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); return false; }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Incasso Condòmino" onSubmit={submit}
      steps={[
        {
          title: "Condòmino",
          validate: () => (!date ? "Inserisci la data" : !residentId ? "Seleziona il condòmino" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <SelectField label="Condòmino" value={residentId} onChange={setResidentId}
                options={[{ value: "", label: "—" }, ...residents]} />
            </div>
          ),
        },
        {
          title: "Rate da incassare",
          validate: () => (settlements.length === 0 || total === 0 ? "Seleziona almeno una rata" : null),
          content: (
            <div>
              {installments.columns.map((c) => (
                <CheckboxField key={c.id}
                  label={`${c.header} — ${formatEUR(fromCents(instRow?.byInstallment[c.id]?.cents ?? 0))}`}
                  checked={checked[c.id] ?? false}
                  onChange={(v) => setChecked((m) => ({ ...m, [c.id]: v }))} />
              ))}
              <p>Totale incasso: {formatEUR(fromCents(total))}</p>
            </div>
          ),
        },
        {
          title: "Conto di liquidità",
          validate: () => (!liquid ? "Seleziona il conto" : null),
          content: (
            <SelectField label="Conto di liquidità" value={liquid} onChange={setLiquidAccountId}
              options={allOpts} />
          ),
        },
        { title: "Conferma", content: <p>Incasso di {formatEUR(fromCents(total))} su {accountLabel(allOpts, liquid)}</p> },
      ]}
    />
  );
}
