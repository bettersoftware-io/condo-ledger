import { useState } from "react";
import type { LedgerAccountRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { SearchBox } from "../../components/common/SearchBox";
import { ToolbarToggle } from "../../components/common/ToolbarToggle";
import { useToast } from "../../components/common/Toast";
import { InlineMoney } from "../../components/grid/inlineEditors";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { mastrino } from "./mastrino";
import { filterAccounts } from "./filterAccounts";
import { AccountDialog } from "./AccountDialog";
import { FunctionalAccountsDialog } from "./FunctionalAccountsDialog";

function find(rows: LedgerAccountRow[], id: string): LedgerAccountRow | null {
  for (const r of rows) { if (r.id === id) return r; if (r.children) { const f = find(r.children, id); if (f) return f; } }
  return null;
}

export function ContiSection() {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const selection = rt.useSelection();
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [dialog, setDialog] = useState<"add" | "edit" | "functional" | null>(null);
  const allRows = rt.useLedgerAccountsTree();
  const rows = filterAccounts(allRows, query, hideEmpty);
  const selId = rt.useSelectedRow("conti");
  // detail lookup uses allRows so selection survives filtering
  const sel = selId ? find(allRows, selId) : null;
  const functional = rt.useFunctionalAccounts();
  const isFunctional = !!selId && Object.values(functional).includes(selId);
  const txns = rt.useLedgerTransactions();
  const card = sel ? mastrino(txns, sel.id) : [];

  const stub = () => toast("Non disponibile nel prototipo");
  const actions = [
    { icon: "add", label: "Aggiungi", primary: true, onClick: () => setDialog("add") },
    { icon: "edit", label: "Modifica", disabled: !sel, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi", disabled: !sel || !!sel?.children?.length || isFunctional,
      onClick: () => { if (periodId && selId) { rt.commands.removeAccountRow(periodId, selId); rt.selectRow("conti", null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "edit", label: "Conti funzionali", onClick: () => setDialog("functional") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
    { icon: "excel", label: "Excel", onClick: stub },
    { sep: true, icon: "", label: "" },
    { icon: "refresh", label: "Aggiorna", onClick: () => rt.select({ ...selection }) },
  ];

  const columns: TreeColumn<LedgerAccountRow>[] = [
    { id: "label", header: "Conti", cell: (r) => r.label },
    { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
    { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
    { id: "saldo", header: "Saldo", align: "right", cell: (r) => <MoneyText value={r.saldo} /> },
    { id: "rd", header: "R/d", cell: (r) => r.rd ?? "" },
    { id: "tabelle", header: "Tabelle di riparto", cell: (r) => r.tabelle ?? "" },
    { id: "restr", header: "Restr. competenza", cell: (r) => r.restriction ?? "" },
    { id: "preventivo", header: "Preventivo", align: "right", cell: (r) =>
        r.kind === "regular" && r.preventivo !== null && periodId
          ? <InlineMoney value={r.preventivo} onCommit={(cents) => rt.commands.setPreventivo(periodId, r.id, cents)} />
          : (r.preventivo ? <MoneyText value={r.preventivo} /> : <span>—</span>) },
  ];

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
      title="Conti, Mastrini e Bilancio" actions={actions}
      legend={<div>Albero del piano dei conti. Raggruppamenti in grassetto con subtotali.</div>}
      toolbarRight={
        <>
          <ToolbarToggle label="Nascondi conti vuoti" checked={hideEmpty} onChange={setHideEmpty} />
          <SearchBox value={query} onChange={setQuery} placeholder="Cerca conto…" />
        </>
      }
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "grouping" ? "group" : "row")} selectedId={selId} onSelect={(r) => rt.selectRow("conti", r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
      <AccountDialog open={dialog === "add" || dialog === "edit"}
        editing={dialog === "edit" ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <FunctionalAccountsDialog open={dialog === "functional"} onOpenChange={(o) => !o && setDialog(null)} />
    </SectionPanel>
  );
}
