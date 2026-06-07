import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./GestioneTree.module.css";

export function GestioneTree() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const sel = rt.useSelection();
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Scegli Gestione</div>
      <div className={styles.list}>
        {tree.map((cond) => (
          <div key={cond.id}>
            <div className={styles.cond}><Icon name="building" size={14} /> {cond.code} — {cond.name.split(" (")[0]}</div>
            {cond.periods.map((p) => (
              <div
                key={p.id}
                className={`${styles.period} ${sel.accountingPeriodId === p.id ? styles.selected : ""}`}
                onClick={() => rt.select({ condominiumId: cond.id, accountingPeriodId: p.id })}
              >
                {p.name}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
