import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../components/forms/fields";
import { useToast } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { distributeInstallments } from "../../recompute/installments";

export function CreateInstallmentsWizard({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const tables = rt.useDistributionTables();
  const existing = rt.useInstallments();

  const [tableId, setTableId] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [count, setCount] = useState("4");
  const [cadence, setCadence] = useState("3");
  const [firstExpiry, setFirstExpiry] = useState("");

  const reset = () => { setTableId(""); setTotalCents(0); setCount("4"); setCadence("3"); setFirstExpiry(""); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const n = parseInt(count, 10);
  const cad = parseInt(cadence, 10);
  const table = tables.find((t) => t.id === tableId) ?? null;
  const preview = table && Number.isInteger(n) && n > 0 && totalCents > 0 && Number.isInteger(cad)
    ? distributeInstallments(totalCents, table.items.map((i) => i.coefficient), n)
    : [];

  const submit = (): boolean => {
    if (!periodId) return false;
    try {
      rt.commands.createInstallments(periodId, {
        count: n, firstExpiry, cadenceMonths: cad, totalCents, tableId,
      });
      toast("Rate create");
      return true;
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); return false; }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Crea Rate da Preventivo" onSubmit={submit}
      steps={[
        {
          title: "Numero e periodo",
          validate: () =>
            !tableId ? "Seleziona la tabella di riparto"
            : totalCents <= 0 ? "Inserisci il totale preventivo"
            : !Number.isInteger(n) || n < 1 || n > 12 ? "Numero rate non valido (1–12)"
            : !Number.isInteger(cad) || cad < 1 ? "Cadenza non valida"
            : !firstExpiry ? "Inserisci la prima scadenza" : null,
          content: (
            <div>
              <SelectField label="Tabella di riparto" value={tableId} onChange={setTableId}
                options={[{ value: "", label: "—" }, ...tables.map((t) => ({ value: t.id, label: t.name }))]} />
              <MoneyField label="Totale preventivo" cents={totalCents} onChange={setTotalCents} />
              <TextField label="Numero rate" value={count} onChange={setCount} type="number" />
              <TextField label="Cadenza (mesi)" value={cadence} onChange={setCadence} type="number" />
              <DateField label="Prima scadenza" value={firstExpiry} onChange={setFirstExpiry} />
            </div>
          ),
        },
        {
          title: "Distribuzione",
          content: (
            <table>
              <thead><tr><th>Unità</th><th>Totale</th></tr></thead>
              <tbody>
                {(table?.items ?? []).map((item, i) => (
                  <tr key={item.unitId}>
                    <td>{item.unitLabel}</td>
                    <td>{formatEUR(fromCents((preview[i] ?? []).reduce((a, b) => a + b, 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        },
        {
          title: "Revisione",
          content: (
            <div>
              {existing.rows.length > 0 && (
                <p role="alert"><strong>Attenzione:</strong> le rate esistenti verranno sostituite.</p>
              )}
              <p>{count} rate ogni {cadence} mesi dalla prima scadenza, per un totale di {formatEUR(fromCents(totalCents))}.</p>
            </div>
          ),
        },
      ]}
    />
  );
}
