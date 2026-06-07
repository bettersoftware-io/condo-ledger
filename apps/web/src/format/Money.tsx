import type { Money } from "@cl/domain";
import { formatEUR } from "@cl/domain";
import styles from "./Money.module.css";

export function MoneyText({ value }: { value: Money }) {
  const tone = value.cents > 0 ? "positive" : value.cents < 0 ? "negative" : "zero";
  return <span className={`${styles.cell} ${styles[tone]}`}>{formatEUR(value)}</span>;
}
