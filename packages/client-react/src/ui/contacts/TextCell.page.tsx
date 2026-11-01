import { render } from "@testing-library/react";

import { TextCell, type TextCellProps } from "./TextCell.tsx";

/** What a test can ask of a text cell. */
export interface TextCellPage {
  text: () => string;
  /** The tooltip a person gets on hovering the cell; null when it has none. */
  tooltip: () => string | null;
}

export function mountTextCell(props: TextCellProps): TextCellPage {
  const rendered = render(<TextCell {...props} />);

  function cell(): Element {
    const found = rendered.container.firstElementChild;

    if (found === null) {
      throw new Error("the text cell drew nothing");
    }

    return found;
  }

  return {
    text: (): string => {
      return cell().textContent ?? "";
    },
    tooltip: (): string | null => {
      return cell().getAttribute("title");
    },
  };
}
