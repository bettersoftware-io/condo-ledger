import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface ColumnSpec {
  def: number;
  min: number;
  max: number;
  grow: boolean;
}

export interface ColumnsState {
  /** null = not resized */
  widths: (number | null)[];
  template: string;
}

export interface ColumnsIntents {
  resize: (index: number, px: number) => void;
}

interface Resize {
  type: "resize";
  index: number;
  px: number;
}

/** The prototype's rule: the first `grow` columns' worth is one flexible column between growMin and growMax; the others may go from 60% to 220% of their width. */
export function columnSpecsFrom(
  widths: number[],
  grow: number,
  growMin: number,
  growMax: number,
): ColumnSpec[] {
  return widths.map((width, index) => {
    if (index === grow) {
      return { def: width, min: growMin, max: growMax, grow: true };
    }

    return {
      def: width,
      min: Math.max(34, Math.round(width * 0.6)),
      max: Math.round(width * 2.2),
      grow: false,
    };
  });
}

/** The CSS grid template: a resized column is its pixels, a flexible one `minmax(min,1fr)`, any other its default. */
export function templateOf(
  spec: readonly ColumnSpec[],
  widths: readonly (number | null)[],
): string {
  return spec
    .map((column, index) => {
      const width = widths[index] ?? null;

      if (width !== null) {
        return `${width}px`;
      }

      return column.grow ? `minmax(${column.min}px,1fr)` : `${column.def}px`;
    })
    .join(" ");
}

/** The widths of a grid's columns, resizable within each column's bounds. */
export function createColumnsMachine(
  spec: readonly ColumnSpec[],
): Machine<ColumnsState, ColumnsIntents> {
  const widths = spec.map((): number | null => {
    return null;
  });

  return createReducerMachine(
    { widths, template: templateOf(spec, widths) },
    reduceColumns(spec),
    (dispatch) => {
      return {
        resize: (index: number, px: number): void => {
          dispatch({ type: "resize", index, px });
        },
      };
    },
  );
}

export function reduceColumns(
  spec: readonly ColumnSpec[],
): (current: ColumnsState, action: Resize) => ColumnsState {
  return (current: ColumnsState, action: Resize): ColumnsState => {
    const column = spec[action.index];

    if (column === undefined) {
      return current;
    }

    const widths = current.widths.map((width, index) => {
      return index === action.index
        ? Math.min(column.max, Math.max(column.min, action.px))
        : width;
    });

    return { widths, template: templateOf(spec, widths) };
  };
}
