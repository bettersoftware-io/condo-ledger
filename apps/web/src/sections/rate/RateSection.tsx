import { useState } from "react";
import type { InstallmentRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { CreateInstallmentsWizard } from "./CreateInstallmentsWizard";
import { MoneyText } from "../../format";
import { InlineMoney } from "../../components/grid/inlineEditors";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import { EditInstallmentDialog } from "./EditInstallmentDialog";

export function RateSection() {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const { columns: instCols, rows } = rt.useInstallments();
  const [wizard, setWizard] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const toast = useToast();
  const stub = () => toast("Non disponibile nel prototipo");

  const columns: TreeColumn<InstallmentRow>[] = [
    { id: "label", header: "Unità / Condòmino", cell: (r) => r.label },
    { id: "role", header: "Ruolo", cell: (r) => r.role ?? "" },
    { id: "saldoPrec", header: "Saldo prec.", align: "right", cell: (r) => <MoneyText value={r.saldoPrec} /> },
    { id: "totPreventivo", header: "Tot. preventivo", align: "right", cell: (r) => <MoneyText value={r.totPreventivo} /> },
    { id: "totDovuto", header: "Tot. dovuto", align: "right", cell: (r) => <MoneyText value={r.totDovuto} /> },
    ...instCols.map((c) => ({
      id: c.id,
      header: c.locked ? `${c.header} (bloccata)` : c.header,
      align: "right" as const,
      cell: (r: InstallmentRow) => {
        const value = r.byInstallment[c.id] ?? { cents: 0 };
        const mark = r.overridden?.[c.id] ? " •" : "";
        if (r.kind === "group" || !periodId) return <><MoneyText value={value} />{mark}</>;
        if (c.locked) return <><MoneyText value={value} />{mark}</>;
        return <><InlineMoney value={value} onCommit={(cents) => {
          try { rt.commands.setInstallmentAmount(periodId, r.id, c.id, cents); }
          catch (e) { toast(e instanceof Error ? e.message : "Importo non valido"); }
        }} />{mark}</>;
      },
    })),
  ];

  const actions = [
    { icon: "add", label: "Crea rate da preventivo", primary: true, onClick: () => setWizard(true) },
    { icon: "edit", label: "Modifica rata", onClick: () => setEditDialog(true) },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
  ];

  const unitCount = rows.reduce((n, g) => n + (g.children?.length ?? 0), 0);

  return (
    <SectionPanel
      title="Prospetto Rate" actions={actions} count={unitCount} countNoun="unità"
      legend={<div>Doppio-click su una rata per modificarla; • = importo modificato a mano.</div>}
    >
      <TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
      <CreateInstallmentsWizard open={wizard} onOpenChange={setWizard} />
      <EditInstallmentDialog open={editDialog} onOpenChange={setEditDialog} />
    </SectionPanel>
  );
}
