import type { ChangeEvent, ReactElement } from "react";

import type {
  BudgetAllocationForm,
  BudgetAllocationSummary,
  JournalContext,
  WizardState,
} from "@cl/client-core";
import { rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { allocationReasonText } from "#/ui/allocation/allocationReasons.ts";
import { FormField } from "#/ui/FormField.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the Budget allocation wizard over the selected period, and hands its body plain props. */
export function BudgetAllocationWizard({
  onSaved,
  onCancel,
}: WizardProps): ReactElement {
  const { useBudgetAllocationWizard, useJournalContext } = useViewModel();
  const wizard = useBudgetAllocationWizard();
  const context = useJournalContext();
  const saving = useWizardSave(wizard.save, onSaved);

  function edit(patch: Partial<BudgetAllocationForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  return (
    <BudgetAllocationBody
      context={context}
      state={wizard.state}
      refusal={saving.refusal}
      onEdit={edit}
      onNext={wizard.next}
      onBack={wizard.back}
      onSave={saving.save}
      onCancel={onCancel}
    />
  );
}

/**
 * One step: the description, the helper text, and the postings the period's
 * budget allocation posts. The allocation's own refusal (an allocation
 * already posted, a budget no table allocates, a missing account) cannot be
 * mended in this window, so it shows from the start; a blank description
 * waits for the person's edit, as in every wizard.
 */
function BudgetAllocationBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: BudgetAllocationBodyProps): ReactElement {
  const { form, summary, verdict } = state;
  const standing =
    !verdict.ok && verdict.reason !== "blank-description"
      ? verdict.reason
      : null;

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  /** The reason in the allocation's words, with the verdict's detail when it is the verdict's reason. */
  function reasonText(reason: string): string {
    const detail =
      !verdict.ok && verdict.reason === reason ? verdict.detail : undefined;

    return allocationReasonText(
      rejected(reason, detail),
      summary.accountPath === null ? {} : { accountPath: summary.accountPath },
    );
  }

  return (
    <WizardDialog
      name="Budget Allocation — Accounting entry summary"
      context={context}
      state={state}
      refusal={refusal ?? standing}
      reasonText={reasonText}
      onNext={onNext}
      onBack={onBack}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Description" required>
        <input
          className="wizard-input"
          value={form.description}
          onChange={editDescription}
        />
      </FormField>
      <p className="wizard-hint" data-testid={TESTIDS.budgetAllocationHelper}>
        Auto-generated from the approved budget — each owner is charged their
        share and the revenue account is credited.
      </p>
    </WizardDialog>
  );
}

interface BudgetAllocationBodyProps {
  context: JournalContext | null;
  state: WizardState<BudgetAllocationForm, BudgetAllocationSummary>;
  /** Why the journal store refused the last save; null when it did not. */
  refusal: string | null;
  onEdit: (patch: Partial<BudgetAllocationForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}
