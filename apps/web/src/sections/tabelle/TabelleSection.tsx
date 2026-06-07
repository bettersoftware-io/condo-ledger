import { useState } from "react";
import type { DistributionRow, DistributionTableItem, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { TreeTable } from "../../components/grid/TreeTable";
import { InlineNumber } from "../../components/grid/inlineEditors";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./TabelleSection.module.css";

export function TabelleSection() {
  const rt = useAppRuntime();
  const tables = rt.useDistributionTables();
  const [selTableId, setSelTableId] = useState<string | null>(tables[0]?.id ?? null);
  const [type, setType] = useState<"estimate" | "current">("estimate");
  const dist = rt.useDistribution(type);
  // local editable coefficient overrides (prototype: behind a port later)
  const [coeffOverrides, setCoeffOverrides] = useState<Record<string, number>>({});

  const selTable = tables.find((t) => t.id === selTableId) ?? tables[0] ?? null;

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
      title="Tabelle Millesimali e Riparto" actions={STANDARD_ACTIONS}
      count={tables.length} countNoun="tabelle"
      legend={<div>Doppio-click su un coefficiente per modificarlo. Preventivo = stime; Consuntivo = importi effettivi.</div>}
    >
      <SplitPane
        top={
          <div className={styles.top}>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Tabelle</div>
              {tables.map((t) => (
                <div key={t.id} className={`${styles.tableItem} ${selTable?.id === t.id ? styles.selected : ""}`} onClick={() => setSelTableId(t.id)}>
                  <span>{t.name}</span><span>{t.total}</span>
                </div>
              ))}
            </div>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Coefficienti — {selTable?.name ?? "—"}</div>
              <table style={{ width: "100%", fontSize: "var(--fs-md)" }}>
                <thead><tr><th style={{ textAlign: "left", padding: 4 }}>Unità</th><th style={{ textAlign: "right", padding: 4 }}>Coefficiente</th></tr></thead>
                <tbody>
                  {(selTable?.items ?? []).map((it: DistributionTableItem) => {
                    const key = `${selTable!.id}:${it.unitId}`;
                    const value = coeffOverrides[key] ?? it.coefficient;
                    return (
                      <tr key={it.unitId}>
                        <td style={{ padding: 4 }}>{it.unitLabel}</td>
                        <td style={{ padding: 4, textAlign: "right" }}>
                          <InlineNumber value={value} onCommit={(n) => setCoeffOverrides((o) => ({ ...o, [key]: n }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        }
        bottom={
          <div>
            <div className={styles.toggle}>
              <button className={`${styles.toggleBtn} ${type === "estimate" ? styles.toggleActive : ""}`} onClick={() => setType("estimate")}>Preventivo</button>
              <button className={`${styles.toggleBtn} ${type === "current" ? styles.toggleActive : ""}`} onClick={() => setType("current")}>Consuntivo</button>
            </div>
            <TreeTable rows={dist.rows} columns={distColumns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
          </div>
        }
      />
    </SectionPanel>
  );
}
