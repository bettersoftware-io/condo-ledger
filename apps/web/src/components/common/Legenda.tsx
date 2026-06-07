import * as Popover from "@radix-ui/react-popover";
import { Icon } from "./Icon";
import styles from "./Legenda.module.css";

export function Legenda({ children }: { children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger}><Icon name="info" size={14} /> Legenda</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} sideOffset={4}>{children}</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function RecordCount({ n, noun }: { n: number; noun: string }) {
  return <span className={styles.count}>{n} {noun}</span>;
}
