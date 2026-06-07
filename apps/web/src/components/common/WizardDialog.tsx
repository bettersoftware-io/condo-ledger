import * as Dialog from "@radix-ui/react-dialog";
import styles from "./WizardDialog.module.css";

export function WizardDialog({
  open, onOpenChange, title, steps,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; steps: string[] }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <div className={styles.steps}>
            {steps.map((s, i) => <span key={i} className={`${styles.step} ${i === 0 ? styles.stepActive : ""}`}>{i + 1}. {s}</span>)}
          </div>
          <p className={styles.note}>Prototipo: i passi della procedura guidata sono illustrati ma non eseguono salvataggi.</p>
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => onOpenChange(false)}>Chiudi</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
