import * as Tabs from "@radix-ui/react-tabs";
import styles from "./DetailPanel.module.css";

export interface DetailTab { id: string; label: string; content: React.ReactNode; }
export function DetailPanel({ tabs }: { tabs: DetailTab[] }) {
  const [first] = tabs;
  if (!first) return null;
  return (
    <Tabs.Root defaultValue={first.id} className={styles.root}>
      <Tabs.List className={styles.list}>
        {tabs.map((t) => <Tabs.Trigger key={t.id} value={t.id} className={styles.trigger}>{t.label}</Tabs.Trigger>)}
      </Tabs.List>
      {tabs.map((t) => <Tabs.Content key={t.id} value={t.id} className={styles.content}>{t.content}</Tabs.Content>)}
    </Tabs.Root>
  );
}
