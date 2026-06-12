import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, expenseOptions, accountLabel } from "./accountOptions";

export function InvoiceWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const detail = rt.useCondominiumDetail();
  const accounts = rt.useLedgerAccountsTree();
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(accounts);
  const expOpts = expenseOptions(accounts);

  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [grossCents, setGrossCents] = useState(0);
  const [withholdingCents, setWithholdingCents] = useState(0);
  const [expenseAccountId, setExpenseAccountId] = useState("");

  const reset = () => {
    setSupplier(""); setInvoiceNumber(""); setDate("");
    setGrossCents(0); setWithholdingCents(0); setExpenseAccountId("");
  };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const suppliers = (detail?.suppliers ?? []).map((s) => ({ value: s.id, label: s.nominativo }));
  const net = grossCents - withholdingCents;
  const supplierName = detail?.suppliers.find((s) => s.id === supplier)?.nominativo ?? supplier;

  const submit = (): boolean => {
    if (!periodId || !functional.payable || !functional.withholding) {
      toast("Configura i conti funzionali (Fornitori / Ritenuta)"); return false;
    }
    try {
      rt.commands.registerInvoice(periodId, {
        date, supplierName, invoiceNumber, grossCents, withholdingCents,
        expenseAccountId, expenseAccountLabel: accountLabel(allOpts, expenseAccountId),
        payableAccountId: functional.payable, payableAccountLabel: accountLabel(allOpts, functional.payable),
        withholdingAccountId: functional.withholding, withholdingAccountLabel: accountLabel(allOpts, functional.withholding),
      });
      toast("Fattura registrata");
      return true;
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); return false; }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Registrazione Fattura" onSubmit={submit}
      steps={[
        {
          title: "Fornitore e importi",
          validate: () =>
            !supplier ? "Seleziona il fornitore"
            : !invoiceNumber ? "Inserisci il numero fattura"
            : !date ? "Inserisci la data"
            : grossCents <= 0 ? "Importo lordo non valido" : null,
          content: (
            <div>
              <SelectField label="Fornitore" value={supplier} onChange={setSupplier}
                options={[{ value: "", label: "—" }, ...suppliers]} />
              <TextField label="Numero fattura" value={invoiceNumber} onChange={setInvoiceNumber} />
              <DateField label="Data" value={date} onChange={setDate} />
              <MoneyField label="Importo lordo" cents={grossCents} onChange={setGrossCents} />
            </div>
          ),
        },
        {
          title: "Ritenuta e conto di spesa",
          validate: () =>
            withholdingCents < 0 || withholdingCents > grossCents ? "Ritenuta non valida"
            : !expenseAccountId ? "Seleziona il conto di spesa" : null,
          content: (
            <div>
              <MoneyField label="Ritenuta d'acconto" cents={withholdingCents} onChange={setWithholdingCents} />
              <SelectField label="Conto di spesa" value={expenseAccountId} onChange={setExpenseAccountId}
                options={[{ value: "", label: "—" }, ...expOpts]} />
              <p>Netto a pagare: {formatEUR(fromCents(net))}</p>
            </div>
          ),
        },
        {
          title: "Conferma",
          content: (
            <div>
              <p>Fattura {invoiceNumber} — {supplierName} — {date}</p>
              <p>Lordo {formatEUR(fromCents(grossCents))}, ritenuta {formatEUR(fromCents(withholdingCents))},
                 netto {formatEUR(fromCents(net))} su {accountLabel(allOpts, expenseAccountId)}</p>
            </div>
          ),
        },
      ]}
    />
  );
}
