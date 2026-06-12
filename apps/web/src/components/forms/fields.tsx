import { useEffect, useId, useRef, useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { parseItMoney } from "./parse";
import styles from "./fields.module.css";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <input id={id} className={styles.input} type={type} value={value}
        onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function DateField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return <TextField {...props} type="date" />;
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <select id={id} className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function MoneyField({ label, cents, onChange }: {
  label: string; cents: number; onChange: (cents: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(formatEUR(fromCents(cents)));
  const focused = useRef(false);
  const lastCommitted = useRef(cents);
  useEffect(() => { lastCommitted.current = cents; }, [cents]);
  useEffect(() => {
    if (!focused.current) setDraft(formatEUR(fromCents(cents)));
  }, [cents]);
  const commit = () => {
    const parsed = parseItMoney(draft);
    if (parsed === null) { setDraft(formatEUR(fromCents(cents))); return; }
    setDraft(formatEUR(fromCents(parsed)));
    if (parsed !== lastCommitted.current) { lastCommitted.current = parsed; onChange(parsed); }
  };
  return (
    <Field label={label} id={id}>
      <input id={id} className={`${styles.input} ${styles.money}`} inputMode="decimal"
        value={draft} onChange={(e) => setDraft(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
    </Field>
  );
}

export function CheckboxField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.checkboxLabel} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </div>
  );
}
