import styles from "./Money.module.css";

export function Coefficient({ value }: { value: number }) {
  return (
    <span className={styles.cell}>
      {value.toLocaleString("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
    </span>
  );
}
