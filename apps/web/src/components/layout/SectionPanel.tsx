import { ActionToolbar, type ToolbarAction } from "../common/ActionToolbar";
import { Legenda, RecordCount } from "../common/Legenda";
import styles from "./SectionPanel.module.css";

export function SectionPanel({
  title, actions, count, countNoun = "elementi", legend, children, toolbarRight,
}: {
  title: string; actions: ToolbarAction[]; count?: number; countNoun?: string;
  legend?: React.ReactNode; children: React.ReactNode; toolbarRight?: React.ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.headerRight}>
          {count !== undefined && <RecordCount n={count} noun={countNoun} />}
          {legend && <Legenda>{legend}</Legenda>}
        </span>
      </div>
      <ActionToolbar actions={actions} right={toolbarRight} />
      <div className={styles.body}>{children}</div>
    </div>
  );
}
