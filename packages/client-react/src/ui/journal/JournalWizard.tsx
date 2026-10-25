import type { ReactElement } from "react";

import type { WizardName } from "@cl/client-core";

import { CollectionWizard } from "./wizards/CollectionWizard.tsx";
import { DirectPaymentWizard } from "./wizards/DirectPaymentWizard.tsx";
import { GenericEntryWizard } from "./wizards/GenericEntryWizard.tsx";
import { InvoicePaymentWizard } from "./wizards/InvoicePaymentWizard.tsx";
import { InvoiceWizard } from "./wizards/InvoiceWizard.tsx";
import { MultiCostPaymentWizard } from "./wizards/MultiCostPaymentWizard.tsx";
import { OpeningBalancesWizard } from "./wizards/OpeningBalancesWizard.tsx";
import type { WizardProps } from "./wizards/WizardDialog.tsx";

/** The wizard the dialog machine names, on the entry it edits. Each mounts its own machine, so a wizard opened again starts clean. */
export function JournalWizard({
  wizard,
  editing,
  onSaved,
  onCancel,
}: JournalWizardProps): ReactElement {
  switch (wizard) {
    case "invoice":
      return (
        <InvoiceWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "collection":
      return (
        <CollectionWizard
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
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "multiCostPayment":
      return (
        <MultiCostPaymentWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "genericEntry":
      return (
        <GenericEntryWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "openingBalances":
      return (
        <OpeningBalancesWizard
          editing={editing}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
  }
}

export interface JournalWizardProps extends WizardProps {
  wizard: WizardName;
  /** The entry the wizard rewrites; null for a new one. */
  editing: string | null;
}
