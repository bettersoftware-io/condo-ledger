import type { LedgerAccountRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { mastrino } from "./mastrino";

const columns: TreeColumn<LedgerAccountRow>[] = [
  { id: "label", header: "Conti", cell: (r) => r.label },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
  { id: "saldo", header: "Saldo", align: "right", cell: (r) => <MoneyText value={r.saldo} /> },
  { id: "rd", header: "R/d", cell: (r) => r.rd ?? "" },
  { id: "tabelle", header: "Tabelle di riparto", cell: (r) => r.tabelle ?? "" },
  { id: "restr", header: "Restr. competenza", cell: (r) => r.restriction ?? "" },
  { id: "preventivo", header: "Preventivo", align: "right", cell: (r) => (r.preventivo ? <MoneyText value={r.preventivo} /> : <span>—</span>) },
];

function find(rows: LedgerAccountRow[], id: string): LedgerAccountRow | null {
  for (const r of rows) { if (r.id === id) return r; if (r.children) { const f = find(r.children, id); if (f) return f; } }
  return null;
}

export function ContiSection() {
  const rt = useAppRuntime();
  const rows = rt.useLedgerAccountsTree();
  const selId = rt.useSelectedRow("conti");
  const sel = selId ? find(rows, selId) : null;
  const txns = rt.useLedgerTransactions();
  const card = sel ? mastrino(txns, sel.id) : [];

  const tabs = sel ? [
    { id: "scheda", label: "Scheda Conto", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Conto" value={sel.label} />
          <Field label="Tipo conto" value={sel.kind === "grouping" ? "Raggruppamento" : "Movimentabile"} />
        </FieldGroup>
        <FieldGroup title="Saldi conto">
          <Field label="Dare" value={<MoneyText value={sel.dare} />} />
          <Field label="Avere" value={<MoneyText value={sel.avere} />} />
          <Field label="Saldo" value={<MoneyText value={sel.saldo} />} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "mastrino", label: "Mastrino", content: (
      <table>
        <thead><tr><th>Data</th><th>Descrizione</th><th>Dare</th><th>Avere</th><th>Saldo</th></tr></thead>
        <tbody>
          {card.map((m) => (
            <tr key={m.id}>
              <td><DateText iso={m.date} /></td><td>{m.description}</td>
              <td><MoneyText value={m.dare} /></td><td><MoneyText value={m.avere} /></td>
              <td><MoneyText value={m.saldo} /></td>
            </tr>
          ))}
          {card.length === 0 && <tr><td colSpan={5}>Nessun movimento</td></tr>}
        </tbody>
      </table>
    ) },
  ] : [];

  return (
    <SectionPanel
      title="Conti, Mastrini e Bilancio" actions={STANDARD_ACTIONS}
      legend={<div>Albero del piano dei conti. Raggruppamenti in grassetto con subtotali.</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "grouping" ? "group" : "row")} selectedId={selId} onSelect={(r) => rt.selectRow("conti", r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
    </SectionPanel>
  );
}
