import type { Module } from "@cl/application";
import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./MainNav.module.css";

const TABS: { id: Module; label: string; icon: string }[] = [
  { id: "calendario", label: "Calendario", icon: "calendar" },
  { id: "condomini", label: "Condomini", icon: "building" },
  { id: "anagrafiche", label: "Anagrafiche", icon: "users" },
];

export function MainNav() {
  const rt = useAppRuntime();
  const active = rt.useModule();
  return (
    <nav className={styles.nav}>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`${styles.tab} ${active === t.id ? styles.active : ""}`}
          onClick={() => rt.setModule(t.id)}
        >
          <Icon name={t.icon} /> {t.label}
        </button>
      ))}
    </nav>
  );
}
