import type { ChangeEvent, ReactElement } from "react";

import type {
  JournalContext,
  MultiCostPaymentForm,
  MultiCostPaymentSummary,
  WizardState,
} from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { FormField } from "#/ui/FormField.tsx";
import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { ChoiceSelect } from "./ChoiceSelect.tsx";
import { LineButtons } from "./LineButtons.tsx";
import { PaidFrom } from "./PaidFrom.tsx";
import { BANK_REASONS, reasonText } from "./reasons.ts";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the multi-cost wizard and hands its body plain props. */
export function MultiCostPaymentWizard({
  onSaved,
  onCancel,
}: WizardProps): ReactElement {
  const { useMultiCostPaymentWizard, useJournalContext } = useViewModel();
  const wizard = useMultiCostPaymentWizard();
  const context = useJournalContext();
  const saving = useWizardSave(wizard.save, onSaved);

  function edit(patch: Partial<MultiCostPaymentForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  return (
    <MultiCostPaymentBody
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

/** A bank purchase over several costs: the amount paid, then one line per cost, which must add up to it. */
function MultiCostPaymentBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: MultiCostPaymentBodyProps): ReactElement {
  const { form, summary } = state;

  function wordReason(reason: string): string {
    return reasonText(reason, BANK_REASONS);
  }

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  function editAmount(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ amount: event.target.value });
  }

  function editLine(index: number, change: Partial<CostLine>): void {
    onEdit({
      lines: form.lines.map((line, at) => {
        return at === index ? { ...line, ...change } : line;
      }),
    });
  }

  function addLine(): void {
    onEdit({ lines: [...form.lines, { accountId: null, amount: "" }] });
  }

  function removeLine(): void {
    onEdit({ lines: form.lines.slice(0, -1) });
  }

  return (
    <WizardDialog
      name="Direct payment to multiple cost accounts"
      context={context}
      state={state}
      refusal={refusal}
      reasonText={wordReason}
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
      <FormField label="Amount paid" required>
        <input
          className="wizard-input wizard-amount"
          inputMode="decimal"
          value={form.amount}
          onChange={editAmount}
        />
      </FormField>
      <div className="wizard-section">
        <div className="wizard-lines" data-columns="3">
          <div className="wizard-lines-head">
            <span>#</span>
            <span>Cost account</span>
            <span className="wizard-amount-cell">Amount</span>
          </div>
          {form.lines.map((line, index) => {
            const number = index + 1;

            function chooseAccount(accountId: string | null): void {
              editLine(index, { accountId });
            }

            function typeAmount(event: ChangeEvent<HTMLInputElement>): void {
              editLine(index, { amount: event.target.value });
            }

            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the form; lines carry no identity of their own
              <div key={index} className="wizard-lines-row">
                <span>{number}</span>
                <span>
                  <ChoiceSelect
                    label={`Line ${number} account`}
                    choices={state.choices}
                    value={line.accountId}
                    onChoose={chooseAccount}
                  />
                </span>
                <span>
                  <input
                    className="wizard-input wizard-line-amount"
                    aria-label={`Line ${number} amount`}
                    inputMode="decimal"
                    value={line.amount}
                    onChange={typeAmount}
                  />
                </span>
              </div>
            );
          })}
          <div className="wizard-lines-foot">
            <span />
            <span className="wizard-total-label">Total:</span>
            <span
              className="wizard-amount-cell"
              data-testid={TESTIDS.wizardLinesTotal}
            >
              <Money cents={summary.linesTotal} variant="plain" />
            </span>
          </div>
        </div>
        <LineButtons onAdd={addLine} onRemove={removeLine} />
      </div>
      <PaidFrom
        name={summary.paidFrom}
        missing={wordReason("no-paid-from-account")}
      />
    </WizardDialog>
  );
}

/** One cost line of the form. */
type CostLine = MultiCostPaymentForm["lines"][number];

interface MultiCostPaymentBodyProps {
  context: JournalContext | null;
  state: WizardState<MultiCostPaymentForm, MultiCostPaymentSummary>;
  refusal: string | null;
  onEdit: (patch: Partial<MultiCostPaymentForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}
