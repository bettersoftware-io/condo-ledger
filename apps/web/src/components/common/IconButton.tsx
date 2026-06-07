import { Icon } from "./Icon";
import styles from "./ActionToolbar.module.css";

export function IconButton({
  icon, label, onClick, disabled, primary,
}: { icon: string; label: string; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      className={`${styles.btn} ${primary ? styles.primary : ""}`}
      title={label} aria-label={label} onClick={onClick} disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
