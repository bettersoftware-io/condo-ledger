import type { ReactElement } from "react";

import type { WizardName } from "@cl/client-core";

import { DirectPaymentWizard } from "./wizards/DirectPaymentWizard.tsx";
import { GenericEntryWizard } from "./wizards/GenericEntryWizard.tsx";
import { InvoicePaymentWizard } from "./wizards/InvoicePaymentWizard.tsx";
import { InvoiceWizard } from "./wizards/InvoiceWizard.tsx";
import { MultiCostPaymentWizard } from "./wizards/MultiCostPaymentWizard.tsx";
import type { WizardProps } from "./wizards/WizardDialog.tsx";

/** The wizard the dialog machine names, on the entry it edits. Each mounts its own machine, so a wizard opened again starts clean. The opening balances wizard has no screen yet, and nothing opens it: it shows nothing. */
export function JournalWizard({
  wizard,
  editing,
  onSaved,
  onCancel,
}: JournalWizardProps): ReactElement | null {
  if (wizard === "openingBalances") {
    return null;
  }

  switch (wizard) {
    case "invoice":
      return (
        <InvoiceWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "invoicePayment":
      return (
        <InvoicePaymentWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "directPaymentCash":
    case "directPaymentBank":
    case "withholdingPayment":
      return (
        <DirectPaymentWizard
          kind={wizard}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "multiCostPayment":
      return <MultiCostPaymentWizard onSaved={onSaved} onCancel={onCancel} />;
    case "genericEntry":
      return <GenericEntryWizard onSaved={onSaved} onCancel={onCancel} />;
  }
}

export interface JournalWizardProps extends WizardProps {
  wizard: WizardName;
  /** The entry the wizard rewrites; null for a new one. */
  editing: string | null;
}
