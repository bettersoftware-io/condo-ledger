import type { ChangeEvent, ReactElement } from "react";

import type {
  BudgetInstallmentsForm,
  BudgetInstallmentsSummary,
  JournalContext,
  ReviewRow,
  WizardState,
} from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { FormField } from "../FormField.tsx";
import { formatDate } from "../format.ts";
import { WizardDialog } from "../journal/wizards/WizardDialog.tsx";
import { Money } from "../Money.tsx";
import { TESTIDS } from "../testids.ts";
import { scheduleReasonText } from "./reasons.ts";
import { useScheduleWrite } from "./useScheduleWrite.ts";

import "./BudgetInstallmentsWizard.css";

/** Reads the Create Budget Installments wizard over the selected period, and hands its body plain props. */
export function BudgetInstallmentsWizard({
  onSaved,
  onCancel,
}: BudgetInstallmentsWizardProps): ReactElement {
  const { useBudgetInstallmentsWizard, useJournalContext } = useViewModel();
  const wizard = useBudgetInstallmentsWizard();
  const context = useJournalContext();
  const saving = useScheduleWrite(
    onSaved,
    "the budget installments were not created",
  );

  function edit(patch: Partial<BudgetInstallmentsForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  function save(): void {
    saving.run(wizard.save);
  }

  return (
    <BudgetInstallmentsBody
      context={context}
      state={wizard.state}
      refusal={saving.refusal}
      onEdit={edit}
      onNext={wizard.next}
      onBack={wizard.back}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface BudgetInstallmentsWizardProps {
  /** The installments are written. */
  onSaved: () => void;
  onCancel: () => void;
}

/** The three steps: the number and the dates, the installments' names and shares, the review per resident. */
function BudgetInstallmentsBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: BudgetInstallmentsBodyProps): ReactElement {
  const { form, summary } = state;

  return (
    <WizardDialog
      name="Create Budget Installments"
      stepTitle={STEP_TITLES[state.step - 1]}
      context={context}
      state={state}
      refusal={refusal}
      reasonText={scheduleReasonText}
      writesEntry={false}
      onNext={onNext}
      onBack={onBack}
      onSave={onSave}
      onCancel={onCancel}
    >
      {state.step === 1 ? (
        <NumberAndDates
          form={form}
          firstDue={summary.firstDue}
          onEdit={onEdit}
        />
      ) : null}
      {state.step === 2 ? (
        <InstallmentRows
          rows={form.rows}
          dueDates={summary.dueDates}
          onEdit={onEdit}
        />
      ) : null}
      {state.step === 3 ? (
        <Review
          names={form.rows.map((row) => {
            return row.name;
          })}
          review={summary.review}
          total={summary.total}
        />
      ) : null}
    </WizardDialog>
  );
}

interface BudgetInstallmentsBodyProps {
  context: JournalContext | null;
  state: WizardState<BudgetInstallmentsForm, BudgetInstallmentsSummary>;
  refusal: string | null;
  onEdit: (patch: Partial<BudgetInstallmentsForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Step 1: how many installments, the first due date, the months between them, and whether to round to whole euros. */
function NumberAndDates({
  form,
  firstDue,
  onEdit,
}: NumberAndDatesProps): ReactElement {
  function editCount(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ count: event.target.value });
  }

  function editFirstDue(text: string): void {
    onEdit({ firstDue: text });
  }

  function editMonths(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ months: event.target.value });
  }

  function editWholeEuros(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ wholeEuros: event.target.checked });
  }

  return (
    <>
      <FormField label="Number of installments" required>
        <input
          className="budget-number"
          inputMode="numeric"
          value={form.count}
          onChange={editCount}
        />
      </FormField>
      <DateField
        label="Due date of the first"
        required
        value={form.firstDue}
        parsed={firstDue}
        onChange={editFirstDue}
      />
      <FormField label="Months between installments" required>
        <input
          className="budget-number"
          inputMode="numeric"
          value={form.months}
          onChange={editMonths}
        />
      </FormField>
      <FormField label="Round to whole euros">
        <input
          type="checkbox"
          className="form-check"
          checked={form.wholeEuros}
          onChange={editWholeEuros}
        />
      </FormField>
    </>
  );
}

interface NumberAndDatesProps {
  form: BudgetInstallmentsForm;
  /** The first due date as it reads; null while it reads as none. */
  firstDue: string | null;
  onEdit: (patch: Partial<BudgetInstallmentsForm>) => void;
}

/** Step 2: one row per new installment, its name and share typed, its due date derived from step 1. */
function InstallmentRows({
  rows,
  dueDates,
  onEdit,
}: InstallmentRowsProps): ReactElement {
  function editRow(index: number, patch: Partial<InstallmentRow>): void {
    onEdit({
      rows: rows.map((row, at) => {
        return at === index ? { ...row, ...patch } : row;
      }),
    });
  }

  return (
    <div className="budget-rows">
      <div className="budget-rows-head">
        <span>Name</span>
        <span>Due date</span>
        <span className="budget-rows-number">% of budget</span>
      </div>
      {rows.map((row, index) => {
        const position = index + 1;
        const due = dueDates[index];

        function editName(event: ChangeEvent<HTMLInputElement>): void {
          editRow(index, { name: event.target.value });
        }

        function editPercentage(event: ChangeEvent<HTMLInputElement>): void {
          editRow(index, { percentage: event.target.value });
        }

        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a row is its position: the batch's installments in order, renamed freely, with no identity of their own
            key={index}
            className="budget-rows-row"
            data-testid={TESTIDS.budgetInstallmentRow}
          >
            <input
              className="budget-rows-input"
              aria-label={`Installment ${position} name`}
              value={row.name}
              onChange={editName}
            />
            <span className="budget-rows-date">
              {due === undefined ? "" : formatDate(due)}
            </span>
            <input
              className="budget-rows-input budget-rows-number"
              aria-label={`Installment ${position} % of budget`}
              inputMode="decimal"
              value={row.percentage}
              onChange={editPercentage}
            />
          </div>
        );
      })}
    </div>
  );
}

type InstallmentRow = BudgetInstallmentsForm["rows"][number];

interface InstallmentRowsProps {
  rows: InstallmentRow[];
  /** One per row; none while step 1's date or months are refused. */
  dueDates: string[];
  onEdit: (patch: Partial<BudgetInstallmentsForm>) => void;
}

/** Step 3: what Save will write, per resident, and what it adds up to. */
function Review({ names, review, total }: ReviewProps): ReactElement {
  return (
    <div className="budget-review-box">
      <table className="budget-review">
        <thead>
          <tr data-testid={TESTIDS.budgetReviewHead}>
            <th>Owner</th>
            <th>Total budget</th>
            <th>Prev. bal.</th>
            <th>Total due</th>
            {names.map((name, index) => {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: a column is its installment's position; two names may be alike while the person types
                <th key={index}>{name}</th>
              );
            })}
            <th>Total inst.</th>
          </tr>
        </thead>
        <tbody>
          {review.map((row) => {
            return (
              <tr
                key={row.residentId}
                data-testid={TESTIDS.budgetReviewRow}
                data-resident-id={row.residentId}
              >
                <td className="budget-review-label">{row.label}</td>
                <td>
                  <Money cents={row.budget} variant="plain" />
                </td>
                <td>
                  <Money cents={row.previousBalance} variant="plain" />
                </td>
                <td>
                  <Money cents={row.due} variant="plain" />
                </td>
                {row.items.map((item, index) => {
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: an item is its installment's position in the batch
                    <td key={index}>
                      <Money cents={item} variant="plain" />
                    </td>
                  );
                })}
                <td>
                  <Money cents={row.total} variant="plain" emphasis />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              className="budget-review-total-label"
              colSpan={names.length + 4}
            >
              Total
            </td>
            <td data-testid={TESTIDS.budgetReviewTotal}>
              <Money cents={total} variant="plain" emphasis />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface ReviewProps {
  /** The new installments' names, one column each. */
  names: string[];
  review: ReviewRow[];
  total: BudgetInstallmentsSummary["total"];
}

const STEP_TITLES: readonly string[] = [
  "Number and dates",
  "Installments",
  "Review",
];
