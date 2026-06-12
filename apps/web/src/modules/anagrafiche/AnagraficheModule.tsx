import { useEffect, useState } from "react";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { PagingBar } from "../../components/common/PagingBar";
import { FilterPane } from "./FilterPane";
import { AnagraficheGrid } from "./AnagraficheGrid";
import { AnagraficaDetails } from "./AnagraficaDetails";
import { AnagraficaLinks } from "./AnagraficaLinks";
import { AnagraficaDialog } from "./AnagraficaDialog";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import styles from "./AnagraficheModule.module.css";

const PAGE_SIZES = [10, 20, 50];

export function AnagraficheModule() {
  const rt = useAppRuntime();
  const toast = useToast();
  const rows = rt.useAnagrafiche();
  const all = rt.useAllAnagrafiche();
  const categories = rt.useAnagraficaCategories();
  const counts = rt.useAnagraficaCategoryCounts();
  const search = rt.useAnagSearch();
  const kind = rt.useAnagKind();
  const stato = rt.useAnagStato();
  const category = rt.useAnagCategory();
  const selectedId = rt.useSelectedAnagrafica();
  const links = rt.useAnagraficaLinks();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<"person" | "company" | "edit" | null>(null);
  const stub = () => toast("Non disponibile nel prototipo");

  // any filter change resets paging — a narrower list may have fewer pages
  useEffect(() => { setPage(1); }, [search, kind, stato, category, pageSize]);

  // ghost selection: a filtered-out id yields null → toolbar disables (Plan-3 convention)
  const selected = rows.find((a) => a.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const actions = [
    { icon: "add", label: "Aggiungi persona", primary: true, onClick: () => setDialog("person") },
    { icon: "add", label: "Aggiungi azienda", onClick: () => setDialog("company") },
    { icon: "edit", label: "Modifica anagrafica", disabled: !selected, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi anagrafica", disabled: !selected,
      onClick: () => { if (selected) { rt.commands.removeAnagrafica(selected.id); rt.selectAnagrafica(null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub },
    { icon: "pdf", label: "PDF", onClick: stub },
  ];

  return (
    <SectionPanel
      title="Anagrafiche" actions={actions} count={rows.length} countNoun="anagrafiche"
      legend={<div>Registro unico dello studio: persone fisiche e società. Le categorie a sinistra filtrano l'elenco.</div>}
      toolbarRight={
        <label className={styles.pageSize}>Righe{" "}
          <select aria-label="Righe per pagina" value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      }
    >
      <div className={styles.layout}>
        <FilterPane search={search} onSearch={rt.setAnagSearch}
          kind={kind} onKind={rt.setAnagKind}
          stato={stato} onStato={rt.setAnagStato}
          category={category} onCategory={rt.setAnagCategory}
          categories={categories} counts={counts} />
        <div className={styles.main}>
          <div className={styles.gridWrap}>
            <AnagraficheGrid rows={visible} selectedId={selectedId} onSelect={rt.selectAnagrafica} />
          </div>
          <PagingBar page={safePage} pageCount={pageCount} onPage={setPage} />
          <div className={styles.detail}>
            <DetailPanel tabs={[
              { id: "dettagli", label: "Dettagli Anagrafica",
                content: <AnagraficaDetails anagrafica={selected} /> },
              { id: "condomini", label: "Anagrafiche Condomini",
                content: <AnagraficaLinks links={selected ? links : []} /> },
            ]} />
          </div>
        </div>
      </div>
      <AnagraficaDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        kind={dialog === "company" ? "company" : dialog === "edit" ? (selected?.kind ?? "person") : "person"}
        editing={dialog === "edit" ? selected : null}
        categories={categories}
        anagrafiche={all}
      />
    </SectionPanel>
  );
}
