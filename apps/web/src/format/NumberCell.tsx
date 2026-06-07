import styles from "./Money.module.css";
export function NumberCell({ value }: { value: number }) {
  return <span className={styles.cell}>{value.toLocaleString("it-IT")}</span>;
}
