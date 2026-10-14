import {
  Banknote,
  Calculator,
  CreditCard,
  FileText,
  PencilLine,
  Receipt,
  Users,
} from "lucide-react";
import type { ReactElement } from "react";

import type { EntryKind } from "@cl/domain";

import { TESTIDS } from "../testids.ts";

import "./EntryIcon.css";

/** A journal entry's glyph, by its kind; the stylesheet tints it from `data-kind`. */
export function EntryIcon({ kind }: EntryIconProps): ReactElement {
  return (
    <span
      className="entry-icon"
      data-kind={kind}
      data-testid={TESTIDS.entryIcon}
    >
      {GLYPHS[kind]}
    </span>
  );
}

export interface EntryIconProps {
  kind: EntryKind;
}

/** The README's emoji (🧾 📄 💶 …), as lucide glyphs. */
const GLYPHS: Record<EntryKind, ReactElement> = {
  openingBalances: <Receipt size={14} />,
  closingBalances: <Receipt size={14} />,
  invoice: <FileText size={14} />,
  collection: <Banknote size={14} />,
  invoicePayment: <CreditCard size={14} />,
  directPaymentBank: <CreditCard size={14} />,
  directPaymentCash: <CreditCard size={14} />,
  withholdingPayment: <CreditCard size={14} />,
  budgetAllocation: <Calculator size={14} />,
  individualExpense: <Users size={14} />,
  generic: <PencilLine size={14} />,
};
