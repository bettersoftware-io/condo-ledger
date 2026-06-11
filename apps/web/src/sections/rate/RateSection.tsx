import { useState } from "react";
import type { InstallmentRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { WizardDialog, shellSteps } from "../../components/common/WizardDialog";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

export function RateSection() {
  const rt = useAppRuntime();
  const { columns: instCols, rows } = rt.useInstallments();
  const [wizard, setWizard] = useState(false);

  const columns: TreeColumn<InstallmentRow>[] = [
    { id: "label", header: "Unità / Condòmino", cell: (r) => r.label },
    { id: "role", header: "Ruolo", cell: (r) => r.role ?? "" },
    { id: "saldoPrec", header: "Saldo prec.", align: "right", cell: (r) => <MoneyText value={r.saldoPrec} /> },
    { id: "totPreventivo", header: "Tot. preventivo", align: "right", cell: (r) => <MoneyText value={r.totPreventivo} /> },
    { id: "totDovuto", header: "Tot. dovuto", align: "right", cell: (r) => <MoneyText value={r.totDovuto} /> },
    ...instCols.map((c) => ({
      id: c.id, header: c.header, align: "right" as const,
      cell: (r: InstallmentRow) => <MoneyText value={r.byInstallment[c.id] ?? { cents: 0 }} />,
    })),
  ];

  const actions = [
    { icon: "add", label: "Crea rate da preventivo", primary: true, onClick: () => setWizard(true) },
    { icon: "edit", label: "Modifica rata" },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa" }, { icon: "pdf", label: "PDF" },
  ];

  const unitCount = rows.reduce((n, g) => n + (g.children?.length ?? 0), 0);

  return (
    <SectionPanel
      title="Prospetto Rate" actions={actions} count={unitCount} countNoun="unità"
      legend={<div>Una colonna per rata. Gli importi sono modificabili nel prodotto finale.</div>}
    >
      <TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
      <WizardDialog open={wizard} onOpenChange={setWizard}
        title="Crea Rate da Preventivo"
        steps={shellSteps(["Numero e periodo", "Distribuzione", "Revisione", "Conto liquidità"])} />
    </SectionPanel>
  );
}
