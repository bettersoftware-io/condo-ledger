import { useState } from "react";
import {
  useReactTable, getCoreRowModel, getExpandedRowModel, flexRender,
  type ColumnDef, type ExpandedState, type Row as TanRow,
} from "@tanstack/react-table";
import type { TreeColumn, TreeTableProps } from "@cl/application";
import { Icon } from "../common/Icon";
import styles from "./TreeTable.module.css";

export function TreeTable<Row extends { id: string; children?: Row[] }>(
  { rows, columns, getRowKind, selectedId, onSelect }: TreeTableProps<Row>,
) {
  const [expanded, setExpanded] = useState<ExpandedState>(true); // expand all by default

  const colDefs: ColumnDef<Row>[] = columns.map((c: TreeColumn<Row>, idx) => ({
    id: c.id,
    header: c.header,
    cell: ({ row }) => {
      const node = c.cell(row.original);
      if (idx === 0) {
        return (
          <span className={styles.tree} style={{ paddingLeft: row.depth * 14 }}>
            {row.getCanExpand() ? (
              <button className={styles.toggle} onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}>
                <Icon name={row.getIsExpanded() ? "chevronDown" : "chevronRight"} size={12} />
              </button>
            ) : <span className={styles.spacer} style={{ width: 12 }} />}
            {node}
          </span>
        );
      }
      return node;
    },
    meta: { align: c.align },
  }));

  const table = useReactTable({
    data: rows,
    columns: colDefs,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (r) => r.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <table className={styles.table}>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => {
              const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align;
              return (
                <th key={h.id} className={`${styles.th} ${align === "right" ? styles.thRight : ""}`}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: TanRow<Row>) => {
          const kind = getRowKind?.(row.original);
          const isGroup = kind === "group";
          return (
            <tr
              key={row.id}
              className={`${styles.tr} ${isGroup ? styles.group : ""} ${selectedId === row.original.id ? styles.selected : ""}`}
              onClick={() => onSelect?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => {
                const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                return (
                  <td key={cell.id} className={`${styles.td} ${align === "right" ? styles.tdRight : ""}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
