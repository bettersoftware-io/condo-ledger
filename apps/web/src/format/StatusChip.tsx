import styles from "./StatusChip.module.css";

const LABELS = { active: "Attivo", inactive: "Inattivo", closed: "Chiuso" } as const;
export function StatusChip({ status }: { status: keyof typeof LABELS }) {
  const tone = status === "active" ? "active" : "closed";
  return (
    <span className={styles.chip}>
      <span className={`${styles.dot} ${styles[tone]}`} />
      {LABELS[status]}
    </span>
  );
}
