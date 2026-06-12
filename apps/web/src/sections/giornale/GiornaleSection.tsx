import { useState } from "react";
import type { Money } from "@cl/domain";
import type { LedgerTxnRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { PagingBar } from "../../components/common/PagingBar";
import { useToast } from "../../components/common/Toast";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { ScritturaWizard } from "./wizards/ScritturaWizard";
import { InvoiceWizard } from "./wizards/InvoiceWizard";
import { IncassoWizard } from "./wizards/IncassoWizard";
import { RitenutaWizard } from "./wizards/RitenutaWizard";

const PAGE_SIZE = 10;

interface GRow {
  id: string; kind: "txn" | "entry";
  date?: string; code?: number; description: string; partita?: string;
  dare: Money; avere: Money;
  children?: GRow[];
}

function toRows(txns: LedgerTxnRow[]): GRow[] {
  return txns.map((t) => ({
    id: t.id, kind: "txn", date: t.date, code: t.code, description: t.description,
    partita: t.partita, dare: t.dare, avere: t.avere,
    children: t.entries.map((e, i) => ({
      id: `${t.id}-e${i}`, kind: "entry", description: e.account, dare: e.dare, avere: e.avere,
    })),
  }));
}

const columns: TreeColumn<GRow>[] = [
  { id: "date", header: "Data", cell: (r) => (r.date ? <DateText iso={r.date} /> : "") },
  { id: "code", header: "N.", cell: (r) => (r.code !== undefined ? String(r.code) : "") },
  { id: "partita", header: "Partita", cell: (r) => r.partita ?? "" },
  { id: "description", header: "Descrizione operazione", cell: (r) => r.description },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
];

export function GiornaleSection() {
  const rt = useAppRuntime();
  const toast = useToast();
  const txns = rt.useLedgerTransactions();
  const [wizard, setWizard] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(txns.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = toRows(txns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE));

  const stub = () => toast("Non disponibile nel prototipo");
  const actions = [
    { icon: "add", label: "Registra fattura", primary: true, onClick: () => setWizard("Registrazione Fattura") },
    { icon: "edit", label: "Incasso", onClick: () => setWizard("Incasso Condòmino") },
    { icon: "edit", label: "Saldi iniziali", onClick: () => setWizard("Apertura Saldi Iniziali") },
    { icon: "edit", label: "Paga ritenuta", onClick: () => setWizard("Pagamento Ritenuta") },
    { icon: "add", label: "Scrittura", onClick: () => setWizard("Scrittura Contabile") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
  ];

  return (
    <SectionPanel
      title="Libro Giornale e Prima Nota" actions={actions}
      count={txns.length} countNoun="scritture"
      legend={<div>Ogni scrittura ha righe Dare/Avere bilanciate, elencate sotto la scrittura.</div>}
    >
      <TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "txn" ? "group" : "row")} />
      <PagingBar page={safePage} pageCount={pageCount} onPage={setPage} />
      <ScritturaWizard mode="scrittura" open={wizard === "Scrittura Contabile"} onOpenChange={(o) => !o && setWizard(null)} />
      <ScritturaWizard mode="saldi" open={wizard === "Apertura Saldi Iniziali"} onOpenChange={(o) => !o && setWizard(null)} />
      <InvoiceWizard open={wizard === "Registrazione Fattura"} onOpenChange={(o) => !o && setWizard(null)} />
      <IncassoWizard open={wizard === "Incasso Condòmino"} onOpenChange={(o) => !o && setWizard(null)} />
      <RitenutaWizard open={wizard === "Pagamento Ritenuta"} onOpenChange={(o) => !o && setWizard(null)} />
    </SectionPanel>
  );
}
