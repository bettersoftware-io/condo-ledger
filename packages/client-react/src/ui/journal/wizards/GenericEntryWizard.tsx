import type { ChangeEvent, ReactElement } from "react";

import type {
  GenericEntryForm,
  GenericEntrySummary,
  JournalContext,
  WizardState,
} from "@cl/client-core";
import { must } from "@cl/domain/support/must.ts";
import { useViewModel } from "@cl/react-bindings";

import { FormField } from "#/ui/FormField.tsx";
import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { ChoiceSelect } from "./ChoiceSelect.tsx";
import { LineButtons } from "./LineButtons.tsx";
import { reasonText } from "./reasons.ts";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the generic wizard, new or editing any entry in its own kind, and hands its body plain props. */
export function GenericEntryWizard({
  editing,
  onSaved,
  onCancel,
}: GenericEntryWizardProps): ReactElement {
  const { useGenericEntryWizard, useJournalContext } = useViewModel();
  const wizard = useGenericEntryWizard(editing);
  const context = useJournalContext();
  const saving = useWizardSave(wizard, onSaved);

  return (
    <GenericEntryBody
      context={context}
      state={wizard.state}
      refusal={saving.refusal}
      onEdit={saving.edit}
      onNext={wizard.next}
      onBack={wizard.back}
      onSave={saving.save}
      onCancel={onCancel}
    />
  );
}

export interface GenericEntryWizardProps extends WizardProps {
  /** The entry the wizard rewrites, which keeps its kind; null for a new generic entry. */
  editing: string | null;
}

/** Any entry, line by line: each line a row of the tree with its debit or its credit, the balance running down the lines. */
function GenericEntryBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: GenericEntryBodyProps): ReactElement {
  const { form, summary } = state;

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  function editLine(index: number, change: Partial<EntryLine>): void {
    onEdit({
      lines: form.lines.map((line, at) => {
        return at === index ? { ...line, ...change } : line;
      }),
    });
  }

  function addLine(): void {
    onEdit({
      lines: [...form.lines, { scopeKey: null, debit: "", credit: "" }],
    });
  }

  function removeLine(): void {
    onEdit({ lines: form.lines.slice(0, -1) });
  }

  return (
    <WizardDialog
      name="Add Accounting Entry"
      context={context}
      state={state}
      refusal={refusal}
      reasonText={reasonText}
      onNext={onNext}
      onBack={onBack}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Description" required>
        <input
          aria-required="true"
          className="wizard-input"
          value={form.description}
          onChange={editDescription}
        />
      </FormField>
      <div className="wizard-section">
        <div className="wizard-lines" data-columns="5">
          <div className="wizard-lines-head">
            <span>#</span>
            <span>Account (Partita)</span>
            <span className="wizard-amount-cell">Debit</span>
            <span className="wizard-amount-cell">Credit</span>
            <span className="wizard-amount-cell">Balance</span>
          </div>
          {form.lines.map((line, index) => {
            const number = index + 1;

            function chooseRow(scopeKey: string | null): void {
              editLine(index, { scopeKey });
            }

            function typeDebit(event: ChangeEvent<HTMLInputElement>): void {
              editLine(index, { debit: event.target.value });
            }

            function typeCredit(event: ChangeEvent<HTMLInputElement>): void {
              editLine(index, { credit: event.target.value });
            }

            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the form; lines carry no identity of their own
              <div key={index} className="wizard-lines-row">
                <span>{number}</span>
                <span>
                  <ChoiceSelect
                    label={`Line ${number} account`}
                    choices={state.choices}
                    value={line.scopeKey}
                    onChoose={chooseRow}
                  />
                </span>
                <span>
                  <input
                    className="wizard-input wizard-line-amount"
                    aria-label={`Line ${number} debit`}
                    inputMode="decimal"
                    value={line.debit}
                    onChange={typeDebit}
                  />
                </span>
                <span>
                  <input
                    className="wizard-input wizard-line-amount"
                    aria-label={`Line ${number} credit`}
                    inputMode="decimal"
                    value={line.credit}
                    onChange={typeCredit}
                  />
                </span>
                <span
                  className="wizard-amount-cell"
                  data-testid={TESTIDS.wizardLineBalance}
                >
                  <Money
                    cents={must(
                      summary.balances[index],
                      `the balance of line ${number}`,
                    )}
                    variant="plain"
                  />
                </span>
              </div>
            );
          })}
          <div className="wizard-lines-foot" data-testid={TESTIDS.wizardTotals}>
            <span />
            <span className="wizard-total-label">Total:</span>
            <span className="wizard-amount-cell">
              <Money cents={summary.debit} variant="plain" />
            </span>
            <span className="wizard-amount-cell">
              <Money cents={summary.credit} variant="plain" />
            </span>
            <span className="wizard-amount-cell wizard-balance">
              <Money cents={summary.balance} variant="plain" />
            </span>
          </div>
        </div>
        <LineButtons onAdd={addLine} onRemove={removeLine} />
      </div>
    </WizardDialog>
  );
}

/** One line of the form. */
type EntryLine = GenericEntryForm["lines"][number];

interface GenericEntryBodyProps {
  context: JournalContext | null;
  state: WizardState<GenericEntryForm, GenericEntrySummary>;
  refusal: string | null;
  onEdit: (patch: Partial<GenericEntryForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}
