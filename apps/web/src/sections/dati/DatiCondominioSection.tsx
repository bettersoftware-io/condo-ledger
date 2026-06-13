import { useState } from "react";
import type { CondominiumNode, AccountingPeriodNode, PeriodSummary } from "@cl/application";
import type { TreeColumn } from "@cl/application";
import type { Money } from "@cl/domain";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { StatusChip, DateText, MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import { CondominiumDialog, PeriodDialog, SupplierDialog, F24Dialog } from "./DatiDialogs";

interface DatiRow { id: string; kind: "cond" | "period"; code: string; name: string; tipo: string; closed?: boolean; competenza?: string; summary?: PeriodSummary; children?: DatiRow[]; }

function toRows(tree: CondominiumNode[], summaries: Record<string, PeriodSummary>): DatiRow[] {
  return tree.map((c) => ({
    id: c.id, kind: "cond", code: c.code, name: c.name, tipo: "Condominio",
    children: c.periods.map((p: AccountingPeriodNode) => ({
      id: p.id, kind: "period", code: "", name: p.name, tipo: p.type,
      closed: p.closed, competenza: [fmt(p.start), fmt(p.end)].filter(Boolean).join(" - "),
      summary: summaries[p.id],
    })),
  }));
}
const fmt = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("it-IT");
};

const money = (pick: (s: PeriodSummary) => Money) =>
  (r: DatiRow) => (r.summary ? <MoneyText value={pick(r.summary)} /> : "");

const columns: TreeColumn<DatiRow>[] = [
  { id: "name", header: "Condominio / Gestione", cell: (r) => (r.kind === "cond" ? `${r.code} — ${r.name}` : r.name) },
  { id: "tipo", header: "Tipo", cell: (r) => r.tipo },
  { id: "closed", header: "Chiuso", cell: (r) => (r.kind === "period" ? (r.closed ? "Sì" : "No") : "") },
  { id: "competenza", header: "Competenza", cell: (r) => r.competenza ?? "" },
  { id: "liq", header: "Liquidità", align: "right", cell: money((s) => s.liquidita) },
  { id: "fondi", header: "Fondi", align: "right", cell: money((s) => s.fondi) },
  { id: "prev", header: "Preventivo", align: "right", cell: money((s) => s.preventivo) },
  { id: "cons", header: "Consuntivo", align: "right", cell: money((s) => s.consuntivo) },
  { id: "sprec", header: "Saldo prec.", align: "right", cell: money((s) => s.saldoPrec) },
  { id: "dovuto", header: "Tot. dovuto", align: "right", cell: money((s) => s.totDovuto) },
];

export function DatiCondominioSection() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const detail = rt.useCondominiumDetail();
  const summaries = rt.usePeriodSummaries();
  const f24s = rt.useF24s();
  const rows = toRows(tree, summaries);

  const selId = rt.useSelectedRow("dati");
  const selCond = tree.find((c) => c.id === selId) ?? null;
  const periodId = rt.useSelection().accountingPeriodId ?? null;

  const toast = useToast();
  const stub = () => toast("Non disponibile nel prototipo");
  const [dialog, setDialog] = useState<"addCond" | "editCond" | "addPeriod" | "addSupplier" | "addF24" | null>(null);
  const [selSupplierId, setSelSupplierId] = useState<string | null>(null);

  const actions = [
    { icon: "add", label: "Aggiungi", primary: true, onClick: () => setDialog("addCond") },
    { icon: "edit", label: "Modifica", disabled: !selCond, onClick: () => setDialog("editCond") },
    { icon: "add", label: "Aggiungi gestione", disabled: !selCond, onClick: () => setDialog("addPeriod") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
    { icon: "excel", label: "Excel", onClick: stub },
  ];

  const tabs = detail ? [
    { id: "scheda", label: "Scheda Condominio", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Intestazione" value={detail.intestazione} />
          <Field label="Codice condominio" value={detail.codice} />
          <Field label="Status" value={<StatusChip status={detail.status} />} />
          <Field label="Tipo" value={detail.tipo} />
          <Field label="Indirizzo" value={detail.indirizzo} />
          <Field label="Codice Fiscale" value={detail.codiceFiscale} />
          <Field label="Data costruzione" value={<DateText iso={detail.dataCostruzione} />} />
        </FieldGroup>
        <FieldGroup title="Altro">
          <Field label="Dati catastali" value={detail.datiCatastali} />
          <Field label="Id sistema" value={detail.idSistema} />
          <Field label="Creato il" value={<DateText iso={detail.creatoIl} />} />
          <Field label="Modificato il" value={<DateText iso={detail.modificatoIl} />} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "fornitori", label: "Fornitori del Condominio", content: (
      <div>
        <div>
          <button aria-label="Aggiungi fornitore" onClick={() => setDialog("addSupplier")}>Aggiungi</button>
          <button aria-label="Rimuovi fornitore" disabled={!selSupplierId}
            onClick={() => { if (periodId && selSupplierId) { rt.commands.removeSupplier(periodId, selSupplierId); setSelSupplierId(null); } }}>Rimuovi</button>
        </div>
        <ul>
          {detail.suppliers.map((s) => (
            <li key={s.id} onClick={() => setSelSupplierId(s.id)}
                style={{ fontWeight: selSupplierId === s.id ? 600 : 400, cursor: "pointer" }}>
              {s.nominativo} — {s.categoria}
            </li>
          ))}
        </ul>
      </div>
    ) },
    { id: "f24", label: "F24", content: (
      <div>
        <button aria-label="Aggiungi F24" onClick={() => setDialog("addF24")}>Aggiungi</button>
        <table>
          <thead><tr><th>Descrizione</th><th>Scadenza</th><th>Importo</th><th>Stato</th></tr></thead>
          <tbody>
            {f24s.map((f) => (
              <tr key={f.id}>
                <td>{f.descrizione}</td><td><DateText iso={f.scadenza} /></td>
                <td><MoneyText value={f.importo} /></td>
                <td>
                  <button onClick={() => periodId && rt.commands.editF24(periodId, f.id, { stato: f.stato === "pagato" ? "da pagare" : "pagato" })}>
                    {f.stato}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) },
    { id: "documenti", label: "Documenti", content: (
      <div>
        <h4>Pubblici</h4><ul>{detail.publicDocs.map((d) => <li key={d}>{d}</li>)}</ul>
        <h4>Privati</h4><ul>{detail.privateDocs.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
    ) },
  ] : [];

  return (
    <SectionPanel
      title="Dati Condominio" actions={actions}
      count={tree.length} countNoun="condomini"
      legend={<div>Righe gruppo = condominio; righe figlie = gestioni (esercizi).</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "cond" ? "group" : "row")}
          selectedId={selId} onSelect={(r) => rt.selectRow("dati", r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
      <CondominiumDialog open={dialog === "addCond" || dialog === "editCond"}
        editing={dialog === "editCond" ? selCond : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <PeriodDialog open={dialog === "addPeriod"} condominiumId={selCond?.id ?? null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <SupplierDialog open={dialog === "addSupplier"} periodId={periodId}
        onOpenChange={(o) => !o && setDialog(null)} />
      <F24Dialog open={dialog === "addF24"} periodId={periodId}
        onOpenChange={(o) => !o && setDialog(null)} />
    </SectionPanel>
  );
}
