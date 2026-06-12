import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { DateField, MoneyField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, accountLabel } from "./accountOptions";

export function RitenutaWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(rt.useLedgerAccountsTree());
  const [date, setDate] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const close = (o: boolean) => { if (!o) { setDate(""); setAmountCents(0); } onOpenChange(o); };

  const submit = (): boolean => {
    if (!periodId || !functional.withholding || !functional.liquid) {
      toast("Configura i conti funzionali (Ritenuta / Liquidità)"); return false;
    }
    try {
      rt.commands.payWithholding(periodId, {
        date, amountCents,
        withholdingAccountId: functional.withholding, withholdingAccountLabel: accountLabel(allOpts, functional.withholding),
        liquidAccountId: functional.liquid, liquidAccountLabel: accountLabel(allOpts, functional.liquid),
      });
      toast("Ritenuta pagata");
      return true;
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); return false; }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Pagamento Ritenuta" onSubmit={submit}
      steps={[
        {
          title: "Importo",
          validate: () => (!date ? "Inserisci la data" : amountCents <= 0 ? "Importo non valido" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <MoneyField label="Importo ritenuta" cents={amountCents} onChange={setAmountCents} />
            </div>
          ),
        },
        { title: "Conferma", content: <p>Pagamento ritenuta di {formatEUR(fromCents(amountCents))}</p> },
      ]}
    />
  );
}
