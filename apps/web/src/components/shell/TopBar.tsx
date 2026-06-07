import { Icon } from "../common/Icon";
import styles from "./TopBar.module.css";

export function TopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        CondoLedger
        <span className={styles.subtitle}>Amministrazione Condomini</span>
      </div>
      <div className={styles.right}>
        <span className={styles.item}><span className={styles.label}>Account:</span> vito</span>
        <span className={styles.item}><span className={styles.label}>Profilo:</span> Amministratore</span>
        <span className={styles.item}><span className={styles.label}>Studio:</span> Studio Bertoli Amministrazioni</span>
        <span className={styles.item}><Icon name="lang" /> IT</span>
        <button className={styles.logout}><Icon name="logout" /> Esci</button>
      </div>
    </header>
  );
}
