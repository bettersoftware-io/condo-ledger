import { GestioneTree } from "./GestioneTree";
import { SectionMenu } from "./SectionMenu";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}><GestioneTree /></div>
      <div className={styles.bottom}><SectionMenu /></div>
    </aside>
  );
}
