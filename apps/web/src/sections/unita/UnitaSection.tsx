import { useState } from "react";
import type { UnitRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import { regroupUnits, type RegroupMode } from "../../mock/regroup";
import { UnitDialog, GroupDialog, ResidentDialog } from "./UnitaDialogs";
import { SubentroWizard } from "./SubentroWizard";

const columns: TreeColumn<UnitRow>[] = [
  { id: "label", header: "Gruppi / Unità / Condòmini", cell: (r) => r.label },
  { id: "tipo", header: "Tipo", cell: (r) => r.unitType ?? "" },
  { id: "restr", header: "Restr. competenza", cell: (r) => r.restriction ?? "" },
  { id: "saldoPrec", header: "Saldo prec.", align: "right", cell: (r) => <MoneyText value={r.saldoPrec} /> },
  { id: "preventivo", header: "Preventivo", align: "right", cell: (r) => <MoneyText value={r.preventivo} /> },
  { id: "consuntivo", header: "Consuntivo", align: "right", cell: (r) => <MoneyText value={r.consuntivo} /> },
  { id: "totDovuto", header: "Tot. dovuto", align: "right", cell: (r) => <MoneyText value={r.totDovuto} /> },
  { id: "versato", header: "Versato", align: "right", cell: (r) => <MoneyText value={r.versato} /> },
];

function findById(rows: UnitRow[], id: string): UnitRow | null {
  for (const r of rows) {
    if (r.id === id) return r;
    if (r.children) { const f = findById(r.children, id); if (f) return f; }
  }
  return null;
}

export function UnitaSection() {
  const rt = useAppRuntime();
  const selId = rt.useSelectedRow("unita");
  const [mode, setMode] = useState<RegroupMode>("gruppo");
  const allRows = rt.useUnitsTree();
  const rows = regroupUnits(allRows, mode);
  const sel = selId ? findById(allRows, selId) : null; // detail works across regroupings

  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const toast = useToast();
  const stub = () => toast("Non disponibile nel prototipo");
  const [dialog, setDialog] = useState<"unit" | "editUnit" | "group" | "resident" | "subentro" | null>(null);
  const selIsUnit = sel?.kind === "unit";
  const actions = [
    { icon: "add", label: "Aggiungi unità", primary: true, onClick: () => setDialog("unit") },
    { icon: "add", label: "Aggiungi gruppo", onClick: () => setDialog("group") },
    { icon: "add", label: "Aggiungi condòmino", disabled: !selIsUnit, onClick: () => setDialog("resident") },
    { icon: "edit", label: "Modifica", disabled: !selIsUnit, onClick: () => setDialog("editUnit") },
    { icon: "edit", label: "Subentro", disabled: !selIsUnit, onClick: () => setDialog("subentro") },
    { icon: "remove", label: "Rimuovi", disabled: !sel || !!sel.children?.length,
      onClick: () => { if (periodId && selId) { rt.commands.removeUnitRow(periodId, selId); rt.selectRow("unita", null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
  ];

  const tabs = sel ? [
    { id: "scheda", label: "Scheda Unità", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Nome unità" value={sel.label} />
          <Field label="Tipo" value={sel.unitType} />
        </FieldGroup>
        <FieldGroup title="Dati identificativi">
          <Field label="Piano" value={sel.floor} />
          <Field label="Interno" value={sel.inner} />
          <Field label="Subalterno" value={sel.sub} />
        </FieldGroup>
        <FieldGroup title="Periodo di competenza ristretto">
          <Field label="Competenza" value={sel.restriction} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "condomini", label: "Condòmini dell'unità", content: (
      <FormCard>
        {(sel.children ?? []).map((c) => <Field key={c.id} label={c.label} value={<MoneyText value={c.totDovuto} />} />)}
      </FormCard>
    ) },
  ] : [];

  // unitCount always reflects the total number of units, regardless of current grouping mode
  const unitCount = allRows.reduce((n, g) => n + (g.children?.length ?? 0), 0);

  return (
    <SectionPanel
      title="Unità, Condòmini e Bilancio Personale" actions={actions}
      count={unitCount} countNoun="unità"
      legend={<div>Gruppo → unità → condòmino. I valori monetari sono blu (positivi) / rossi (negativi).</div>}
      toolbarRight={
        <label>Raggruppa righe per{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as RegroupMode)}>
            <option value="gruppo">Per gruppo</option>
            <option value="unita">Per unità</option>
            <option value="condomino">Per condòmino</option>
          </select>
        </label>
      }
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (mode === "gruppo" && r.kind === "group" ? "group" : "row")} selectedId={selId} onSelect={(r) => rt.selectRow("unita", r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
      <UnitDialog open={dialog === "unit" || dialog === "editUnit"}
        editing={dialog === "editUnit" && selIsUnit ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <GroupDialog open={dialog === "group"} onOpenChange={(o) => !o && setDialog(null)} />
      <ResidentDialog open={dialog === "resident"} unitId={selIsUnit ? sel!.id : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <SubentroWizard open={dialog === "subentro"} unit={selIsUnit ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
    </SectionPanel>
  );
}
