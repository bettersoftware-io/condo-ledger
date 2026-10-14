import type { ReactElement } from "react";

import { TESTIDS } from "#/ui/testids.ts";

/** The read-only "Paid from: {account}" line, or in its place, in red, that the period has no such account. */
export function PaidFrom({ name, missing }: PaidFromProps): ReactElement {
  return (
    <div
      className="wizard-paid-from"
      data-testid={TESTIDS.wizardPaidFrom}
      data-missing={name === null}
    >
      {name === null ? missing : `Paid from: ${name}`}
    </div>
  );
}

export interface PaidFromProps {
  /** The account paid from; null when the period has none. */
  name: string | null;
  /** What to say when there is none. */
  missing: string;
}
