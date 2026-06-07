import styles from "./FormCard.module.css";

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
export function FieldGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      {title && <div className={styles.groupTitle}>{title}</div>}
      {children}
    </div>
  );
}
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value ?? "—"}</span>
    </div>
  );
}
