import { Icon } from "../common/Icon";
import styles from "./Breadcrumb.module.css";

export function Breadcrumb({ segments }: { segments: string[] }) {
  return (
    <div className={styles.bar}>
      <Icon name="home" size={14} />
      {segments.map((s, i) => (
        <span key={i} className={i === segments.length - 1 ? styles.last : styles.seg}>
          <Icon name="chevronRight" size={12} /> {s}
        </span>
      ))}
    </div>
  );
}
