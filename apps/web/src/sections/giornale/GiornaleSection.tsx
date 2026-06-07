import { useState } from "react";
import type { LedgerTxnRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { WizardDialog } from "../../components/common/WizardDialog";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./GiornaleSection.module.css";

interface GRow extends LedgerTxnRow { children?: GRow[]; }

const columns: TreeColumn<GRow>[] = [
  { id: "date", header: "Data", cell: (r) => <DateText iso={r.date} /> },
  { id: "code", header: "N.", cell: (r) => String(r.code) },
  { id: "description", header: "Descrizione operazione", cell: (r) => r.description },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
];

export function GiornaleSection() {
  const rt = useAppRuntime();
  const txns = rt.useLedgerTransactions() as GRow[];
  const [wizard, setWizard] = useState<string | null>(null);

  const actions = [
    { icon: "add", label: "Registra fattura", primary: true, onClick: () => setWizard("Registrazione Fattura") },
    { icon: "edit", label: "Incasso", onClick: () => setWizard("Incasso Condòmino") },
    { icon: "edit", label: "Saldi iniziali", onClick: () => setWizard("Apertura Saldi Iniziali") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa" }, { icon: "pdf", label: "PDF" },
  ];

  const stepsByWizard: Record<string, string[]> = {
    "Registrazione Fattura": ["Fornitore e importi", "Ritenuta/IVA", "Conferma"],
    "Incasso Condòmino": ["Condòmino", "Importo e conto", "Conferma"],
    "Apertura Saldi Iniziali": ["Conto", "Saldi per condòmino", "Conferma"],
  };

  return (
    <SectionPanel
      title="Libro Giornale e Prima Nota" actions={actions}
      count={txns.length} countNoun="scritture"
      legend={<div>Ogni scrittura ha righe Dare/Avere bilanciate, elencate sotto la scrittura.</div>}
    >
      <TreeTable
        rows={txns} columns={columns} getRowKind={() => "row"}
      />
      {/* entries preview under the grid */}
      <div className={styles.entries}>
        {txns.map((t) => (
          <div key={t.id}>
            <strong>#{t.code} {t.description}</strong>
            {t.entries.map((e, i) => (
              <div key={i} className={styles.entryRow}>
                <span>{e.account}</span><MoneyText value={e.dare} /><MoneyText value={e.avere} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <WizardDialog open={wizard !== null} onOpenChange={(o) => !o && setWizard(null)}
        title={wizard ?? ""} steps={wizard ? stepsByWizard[wizard] ?? [] : []} />
    </SectionPanel>
  );
}
