import { Suspense } from "react";
import { TopBar } from "../shell/TopBar";
import { MainNav } from "../shell/MainNav";
import { Breadcrumb } from "../shell/Breadcrumb";
import { Sidebar } from "../sidebar/Sidebar";
import { CondominiModule } from "../../modules/CondominiModule";
import { CalendarioStub } from "../../modules/CalendarioStub";
import { AnagraficheStub } from "../../modules/AnagraficheStub";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./AppShell.module.css";

const SECTION_LABELS: Record<string, string> = {
  dati: "Dati Condominio e Fornitori", unita: "Unità, Condòmini e Bilancio Personale",
  tabelle: "Tabelle Millesimali e Riparto", conti: "Conti, Mastrini e Bilancio",
  giornale: "Libro Giornale e Prima Nota", rate: "Prospetto Rate",
};

export function AppShell() {
  const rt = useAppRuntime();
  const module = rt.useModule();
  const tree = rt.useCondominiumTree();
  const sel = rt.useSelection();
  const section = rt.useSection();

  const cond = tree.find((c) => c.id === sel.condominiumId);
  const period = cond?.periods.find((p) => p.id === sel.accountingPeriodId);
  const segments = module === "condomini"
    ? ["Condomini", cond?.name.split(" (")[0], period?.name, SECTION_LABELS[section]].filter(Boolean) as string[]
    : [module === "calendario" ? "Calendario" : "Anagrafiche"];

  return (
    <div className={styles.shell}>
      <TopBar />
      <MainNav />
      <Breadcrumb segments={segments} />
      <div className={styles.body}>
        {module === "condomini" && <Sidebar />}
        <main className={styles.main}>
          <Suspense fallback={<div style={{ padding: 16 }}>Caricamento…</div>}>
            {module === "condomini" && <CondominiModule />}
            {module === "calendario" && <CalendarioStub />}
            {module === "anagrafiche" && <AnagraficheStub />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
