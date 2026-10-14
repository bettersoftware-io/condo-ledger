import { FileText } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import type {
  DirectPaymentForm,
  DirectPaymentKind,
  DirectPaymentSummary,
  JournalContext,
  WizardState,
} from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { FormField } from "#/ui/FormField.tsx";
import { SelectableList } from "#/ui/SelectableList.tsx";

import { PaidFrom } from "./PaidFrom.tsx";
import { BANK_REASONS, CASH_REASONS, reasonText } from "./reasons.ts";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the direct-payment wizard of its kind and hands its body plain props. */
export function DirectPaymentWizard({
  kind,
  onSaved,
  onCancel,
}: DirectPaymentWizardProps): ReactElement {
  const { useDirectPaymentWizard, useJournalContext } = useViewModel();
  const wizard = useDirectPaymentWizard(kind);
  const context = useJournalContext();
  const saving = useWizardSave(wizard.save, onSaved);

  function edit(patch: Partial<DirectPaymentForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  return (
    <DirectPaymentBody
      kind={kind}
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

export interface DirectPaymentWizardProps extends WizardProps {
  kind: DirectPaymentKind;
}

/** The three one-step payments of the design: a target chosen from a list, an amount, the account paid from. */
function DirectPaymentBody({
  kind,
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: DirectPaymentBodyProps): ReactElement {
  const { form, summary } = state;
  const items = state.choices.map((choice) => {
    return {
      key: choice.key,
      label: choice.label,
      icon: <FileText size={13} />,
    };
  });

  function wordReason(reason: string): string {
    return reasonText(reason, OWN_REASONS[kind]);
  }

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  function editTarget(targetId: string): void {
    onEdit({ targetId });
  }

  function editAmount(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ amount: event.target.value });
  }

  return (
    <WizardDialog
      name={TITLES[kind]}
      context={context}
      state={state}
      refusal={refusal}
      reasonText={wordReason}
      shownInBody="no-paid-from-account"
      onNext={onNext}
      onBack={onBack}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Description">
        <input
          className="wizard-input"
          value={form.description}
          onChange={editDescription}
        />
      </FormField>
      <SelectableList
        label={
          kind === "withholdingPayment"
            ? "Tax account to settle"
            : "Cost account"
        }
        items={items}
        selectedKey={form.targetId}
        onSelect={editTarget}
      />
      <FormField label="Amount" required>
        <input
          className="wizard-input wizard-amount"
          inputMode="decimal"
          value={form.amount}
          onChange={editAmount}
        />
      </FormField>
      <PaidFrom
        name={summary.paidFrom}
        missing={wordReason("no-paid-from-account")}
      />
    </WizardDialog>
  );
}

interface DirectPaymentBodyProps {
  kind: DirectPaymentKind;
  context: JournalContext | null;
  state: WizardState<DirectPaymentForm, DirectPaymentSummary>;
  refusal: string | null;
  /** Carries only the field that changed: a patch naming the description stops its prefill. */
  onEdit: (patch: Partial<DirectPaymentForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** The design's titles (README, "Journal-entry wizards" 4 to 6). */
const TITLES: Record<DirectPaymentKind, string> = {
  directPaymentCash: "Direct Purchase with Cash",
  directPaymentBank: "Direct Purchase via Default Bank Account",
  withholdingPayment: "Withholding-tax Payment to Tax Authority",
};

/** Each kind's own words: the account it pays from is cash or the default bank. */
const OWN_REASONS: Record<
  DirectPaymentKind,
  Readonly<Record<string, string>>
> = {
  directPaymentCash: CASH_REASONS,
  directPaymentBank: BANK_REASONS,
  withholdingPayment: BANK_REASONS,
};
