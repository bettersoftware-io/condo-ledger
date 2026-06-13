import { useState } from "react";
import type { DistributionRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { TreeTable } from "../../components/grid/TreeTable";
import { InlineNumber } from "../../components/grid/inlineEditors";
import { useToast } from "../../components/common/Toast";
import { MoneyText, Coefficient } from "../../format";
import { fromCents } from "@cl/domain";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { roundingByColumn } from "../../recompute/distribution";
import { TableDialog, AddItemDialog } from "./TableDialogs";
import styles from "./TabelleSection.module.css";

interface CoeffRow { id: string; label: string; coefficient: number; competenza: string; }

export function TabelleSection() {
  const rt = useAppRuntime();
  const toast = useToast();
  const tables = rt.useDistributionTables();
  const [selTableId, setSelTableId] = useState<string | null>(tables[0]?.id ?? null);
  const [type, setType] = useState<"estimate" | "current">("estimate");
  const [dialog, setDialog] = useState<"addTable" | "editTable" | "addItem" | null>(null);
  const [selItemId, setSelItemId] = useState<string | null>(null);

  const dist = rt.useDistribution(type);
  const periodId = rt.useSelection().accountingPeriodId ?? null;

  const selTable = tables.find((t) => t.id === selTableId) ?? tables[0] ?? null;

  const stub = () => toast("Non disponibile nel prototipo");
  const actions = [
    { icon: "add", label: "Aggiungi", primary: true, onClick: () => setDialog("addTable") },
    { icon: "edit", label: "Modifica", disabled: !selTable, onClick: () => setDialog("editTable") },
    { icon: "remove", label: "Rimuovi", disabled: !selTable,
      onClick: () => { if (periodId && selTable) { rt.commands.removeTable(periodId, selTable.id); setSelTableId(null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
    { icon: "excel", label: "Excel", onClick: stub },
  ];

  const rounding = roundingByColumn(dist, tables);
  const roundingRow: DistributionRow = {
    id: "row-arrotondamento", kind: "unit", label: "Arrotondamento",
    amounts: Object.fromEntries(Object.entries(rounding).map(([k, v]) => [k, fromCents(v)])),
    total: fromCents(Object.values(rounding).reduce((a, b) => a + b, 0)),
  };

  const coeffRows: CoeffRow[] = (selTable?.items ?? []).map((it) => ({
    id: it.unitId, label: it.unitLabel, coefficient: it.coefficient, competenza: it.competenza,
  }));

  const coeffColumns: TreeColumn<CoeffRow>[] = [
    { id: "label", header: "Unità", cell: (r) => r.label },
    {
      id: "coeff", header: "Coefficiente", align: "right", cell: (r) =>
        periodId && selTable
          ? <InlineNumber value={r.coefficient} onCommit={(n) => rt.commands.setCoefficient(periodId, selTable.id, r.id, n)} />
          : <Coefficient value={r.coefficient} />,
    },
    { id: "competenza", header: "Competenza", cell: (r) => r.competenza },
  ];

  const distColumns: TreeColumn<DistributionRow>[] = [
    { id: "label", header: "Conto / Unità", cell: (r) => r.label },
    ...dist.columns.map((c) => ({
      id: c.accountId, header: c.header, align: "right" as const,
      cell: (r: DistributionRow) => <MoneyText value={r.amounts[c.accountId] ?? { cents: 0 }} />,
    })),
    { id: "total", header: "Totale", align: "right", cell: (r: DistributionRow) => <MoneyText value={r.total} /> },
  ];

  return (
    <SectionPanel
      title="Tabelle Millesimali e Riparto" actions={actions}
      count={tables.length} countNoun="tabelle"
      legend={<div>Doppio-click su un coefficiente per modificarlo. Preventivo = stime; Consuntivo = importi effettivi.</div>}
    >
      <SplitPane
        top={
          <div className={styles.top}>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>
                Tabelle
                <span style={{ float: "right", display: "inline-flex", gap: "var(--sp-2)" }}>
                  <button aria-label="Aggiungi tabella" onClick={() => setDialog("addTable")}>+</button>
                  <button aria-label="Modifica tabella" disabled={!selTable} onClick={() => setDialog("editTable")}>✎</button>
                  <button aria-label="Elimina tabella" disabled={!selTable}
                    onClick={() => { if (periodId && selTable) { rt.commands.removeTable(periodId, selTable.id); setSelTableId(null); } }}>×</button>
                  <button aria-label="Aggiungi coefficiente" disabled={!selTable} onClick={() => setDialog("addItem")}>+r</button>
                  <button aria-label="Rimuovi coefficiente" disabled={!selTable || !selItemId}
                    onClick={() => { if (periodId && selTable && selItemId) { rt.commands.removeTableItem(periodId, selTable.id, selItemId); setSelItemId(null); } }}>−r</button>
                </span>
              </div>
              {tables.map((t) => (
                <div key={t.id} className={`${styles.tableItem} ${selTable?.id === t.id ? styles.selected : ""}`} onClick={() => setSelTableId(t.id)}>
                  <span>{t.name}</span><span>{t.total}</span>
                </div>
              ))}
            </div>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Coefficienti — {selTable?.name ?? "—"}</div>
              <TreeTable rows={coeffRows} columns={coeffColumns} getRowKind={() => "row"}
                selectedId={selItemId} onSelect={(r) => setSelItemId(r.id)} />
            </div>
          </div>
        }
        bottom={
          <div>
            <div className={styles.toggle}>
              <button className={`${styles.toggleBtn} ${type === "estimate" ? styles.toggleActive : ""}`} onClick={() => setType("estimate")}>Preventivo</button>
              <button className={`${styles.toggleBtn} ${type === "current" ? styles.toggleActive : ""}`} onClick={() => setType("current")}>Consuntivo</button>
            </div>
            <TreeTable rows={[...dist.rows, roundingRow]} columns={distColumns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
          </div>
        }
      />
      <TableDialog open={dialog === "addTable" || dialog === "editTable"}
        editing={dialog === "editTable" ? selTable : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <AddItemDialog open={dialog === "addItem"} tableId={selTable?.id ?? null}
        onOpenChange={(o) => !o && setDialog(null)} />
    </SectionPanel>
  );
}
