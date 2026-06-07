import styles from "./SplitPane.module.css";

export function SplitPane({ top, bottom }: { top: React.ReactNode; bottom: React.ReactNode }) {
  return (
    <div className={styles.split}>
      <div className={styles.top}>{top}</div>
      <div className={styles.divider} role="separator" aria-orientation="horizontal" />
      <div className={styles.bottom}>{bottom}</div>
    </div>
  );
}
