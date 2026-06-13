import styles from "./SmallControls.module.css";

export function SearchBox({ value, onChange, placeholder = "Cerca…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input className={styles.search} type="search" placeholder={placeholder}
      value={value} onChange={(e) => onChange(e.target.value)} />
  );
}
