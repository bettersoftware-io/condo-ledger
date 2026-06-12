import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./WizardDialog.module.css";

export interface WizardStep {
  title: string;
  /** step body; omit for a not-yet-built shell step */
  content?: React.ReactNode;
  /** return an error message to block Avanti, or null when valid */
  validate?: () => string | null;
}

export function WizardDialog({
  open, onOpenChange, title, steps, onSubmit, submitLabel = "Conferma",
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string;
  steps: WizardStep[]; onSubmit?: () => void; submitLabel?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  const close = (o: boolean) => { setIdx(0); setError(null); onOpenChange(o); };
  const safeIdx = Math.min(idx, Math.max(0, steps.length - 1));
  const step = steps[safeIdx] ?? { title: "" };
  const last = steps.length === 0 || safeIdx === steps.length - 1;
  const forward = () => {
    const err = step.validate?.() ?? null;
    setError(err);
    if (err) return;
    if (last) { onSubmit?.(); close(false); } else setIdx(safeIdx + 1);
  };
  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={step.content ? undefined : noteId}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <div className={styles.steps}>
            {steps.map((s, i) => (
              <span key={i} className={`${styles.step} ${i === safeIdx ? styles.stepActive : ""}`}>
                {i + 1}. {s.title}
              </span>
            ))}
          </div>
          <div className={styles.body}>
            {step.content ?? (
              <Dialog.Description id={noteId} className={styles.note}>
                Prototipo: contenuto del passo non ancora implementato.
              </Dialog.Description>
            )}
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => close(false)}>Annulla</button>
            <span className={styles.actionsSpacer} />
            {safeIdx > 0 && (
              <button className={styles.btn} onClick={() => { setError(null); setIdx(safeIdx - 1); }}>
                Indietro
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={forward}>
              {last ? submitLabel : "Avanti"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shim: lift legacy `string[]` step titles into shell steps (Plan 2 replaces with real forms). */
export const shellSteps = (titles: string[]): WizardStep[] => titles.map((t) => ({ title: t }));
