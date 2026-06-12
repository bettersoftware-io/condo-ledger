import { useEffect, useState } from "react";
import type { FunctionalRole } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { accountOptions } from "../../components/forms/accountOptions";

const ROLES: { role: FunctionalRole; label: string }[] = [
  { role: "liquid", label: "Conto di liquidità" },
  { role: "payable", label: "Fornitori c/acquisti" },
  { role: "withholding", label: "Erario c/ritenute" },
  { role: "credit", label: "Condòmini c/rate" },
];

export function FunctionalAccountsDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const functional = rt.useFunctionalAccounts();
  const options = accountOptions(rt.useLedgerAccountsTree());
  const [draft, setDraft] = useState<Partial<Record<FunctionalRole, string>>>({});
  useEffect(() => { if (open) setDraft(functional); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!periodId) return;
    for (const { role } of ROLES) {
      const id = draft[role];
      if (id) rt.commands.setFunctionalAccount(periodId, role, id);
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Configura Conti Funzionali"
      onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Ruoli",
        content: (
          <div>
            {ROLES.map(({ role, label }) => (
              <SelectField key={role} label={label} value={draft[role] ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, [role]: v }))}
                options={[{ value: "", label: "—" }, ...options]} />
            ))}
          </div>
        ),
      }]}
    />
  );
}
