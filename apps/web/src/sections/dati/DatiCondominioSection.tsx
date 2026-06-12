import type { CondominiumNode, AccountingPeriodNode, PeriodSummary } from "@cl/application";
import type { TreeColumn } from "@cl/application";
import type { Money } from "@cl/domain";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { StatusChip, DateText, MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

interface DatiRow { id: string; kind: "cond" | "period"; code: string; name: string; tipo: string; closed?: boolean; competenza?: string; summary?: PeriodSummary; children?: DatiRow[]; }

function toRows(tree: CondominiumNode[], summaries: Record<string, PeriodSummary>): DatiRow[] {
  return tree.map((c) => ({
    id: c.id, kind: "cond", code: c.code, name: c.name, tipo: "Condominio",
    children: c.periods.map((p: AccountingPeriodNode) => ({
      id: p.id, kind: "period", code: "", name: p.name, tipo: p.type,
      closed: p.closed, competenza: `${fmt(p.start)} - ${fmt(p.end)}`,
      summary: summaries[p.id],
    })),
  }));
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString("it-IT");

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
  const rows = toRows(tree, summaries);

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
      <FormCard>
        {detail.suppliers.map((s) => <Field key={s.id} label={s.categoria} value={s.nominativo} />)}
      </FormCard>
    ) },
  ] : [];

  return (
    <SectionPanel
      title="Dati Condominio" actions={STANDARD_ACTIONS}
      count={tree.length} countNoun="condomini"
      legend={<div>Righe gruppo = condominio; righe figlie = gestioni (esercizi).</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "cond" ? "group" : "row")} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
    </SectionPanel>
  );
}
