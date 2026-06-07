import type { CondominiSection } from "@cl/application";
import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./SectionMenu.module.css";

const ITEMS: { id: CondominiSection; label: string }[] = [
  { id: "dati", label: "Dati Condomini e Fornitori" },
  { id: "unita", label: "Unità, Condòmini e Bilancio Personale" },
  { id: "tabelle", label: "Tabelle Millesimali e Riparto" },
  { id: "conti", label: "Conti, Mastrini e Bilancio" },
  { id: "giornale", label: "Libro Giornale e Prima Nota" },
  { id: "rate", label: "Prospetto Rate" },
];

export function SectionMenu() {
  const rt = useAppRuntime();
  const active = rt.useSection();
  const sel = rt.useSelection();
  const enabled = Boolean(sel.accountingPeriodId);
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Menu Gestione</div>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          disabled={!enabled}
          className={`${styles.item} ${active === it.id ? styles.active : ""} ${!enabled ? styles.disabled : ""}`}
          onClick={() => rt.setSection(it.id)}
        >
          {it.label}
          {it.id === "dati" || it.id === "conti" ? <Icon name="chevronRight" size={12} /> : null}
        </button>
      ))}
    </div>
  );
}
