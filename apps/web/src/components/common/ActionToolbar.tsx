import { IconButton } from "./IconButton";
import styles from "./ActionToolbar.module.css";

export interface ToolbarAction { icon: string; label: string; onClick?: () => void; disabled?: boolean; primary?: boolean; sep?: boolean; }

export function ActionToolbar({ actions, right }: { actions: ToolbarAction[]; right?: React.ReactNode }) {
  return (
    <div className={styles.bar}>
      {actions.map((a, i) =>
        a.sep ? <span key={i} className={styles.sep} /> :
        <IconButton key={i} icon={a.icon} label={a.label} onClick={a.onClick} disabled={a.disabled} primary={a.primary} />,
      )}
      <span className={styles.spacer} />
      {right}
    </div>
  );
}

export const STANDARD_ACTIONS: ToolbarAction[] = [
  { icon: "add", label: "Aggiungi", primary: true },
  { icon: "edit", label: "Modifica" },
  { icon: "remove", label: "Rimuovi" },
  { sep: true, icon: "", label: "" },
  { icon: "print", label: "Stampa" },
  { icon: "pdf", label: "PDF" },
  { icon: "excel", label: "Excel" },
  { sep: true, icon: "", label: "" },
  { icon: "refresh", label: "Aggiorna" },
];
