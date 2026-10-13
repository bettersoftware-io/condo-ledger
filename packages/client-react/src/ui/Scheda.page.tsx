import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { Scheda } from "./Scheda.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can ask of a record sheet. */
export interface SchedaPage {
  isWide: () => boolean;
  rowCount: () => number;
  valueOf: (label: string) => string;
  toneOf: (label: string) => string | undefined;
  hasGroup: (legend: string) => boolean;
}

export function mountScheda(children: ReactNode, wide = false): SchedaPage {
  const rendered = render(<Scheda wide={wide}>{children}</Scheda>);

  function rows(): HTMLElement[] {
    return rendered.getAllByTestId(TESTIDS.schedaRow);
  }

  function valueElement(label: string): HTMLElement {
    const row = rows().find((candidate) => {
      return within(candidate).queryByText(label) !== null;
    });

    if (row === undefined) {
      throw new Error(`no row labelled ${label}`);
    }

    return row.querySelector<HTMLElement>(".scheda-value") as HTMLElement;
  }

  return {
    isWide: (): boolean => {
      return rendered.getByTestId(TESTIDS.scheda).dataset.wide === "true";
    },
    rowCount: (): number => {
      return rows().length;
    },
    valueOf: (label: string): string => {
      return valueElement(label).textContent ?? "";
    },
    toneOf: (label: string): string | undefined => {
      return valueElement(label).dataset.tone;
    },
    hasGroup: (legend: string): boolean => {
      return rendered.queryByRole("group", { name: legend }) !== null;
    },
  };
}
