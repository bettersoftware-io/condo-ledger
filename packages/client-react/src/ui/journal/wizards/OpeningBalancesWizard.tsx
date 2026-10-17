import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  useRef,
} from "react";

import type {
  JournalContext,
  OpeningAmount,
  OpeningForm,
  OpeningRowView,
  OpeningSummary,
  WizardState,
} from "@cl/client-core";
import { ZERO_CENTS } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { FormField } from "#/ui/FormField.tsx";
import { formatCents } from "#/ui/format.ts";
import { TESTIDS } from "#/ui/testids.ts";

import { reasonText } from "./reasons.ts";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

import "./OpeningBalancesWizard.css";

/** Reads the Opening balances wizard, new or editing the period's opening, and hands its body plain props. */
export function OpeningBalancesWizard({
  editing,
  onSaved,
  onCancel,
}: OpeningBalancesWizardProps): ReactElement {
  const { useOpeningBalancesWizard, useJournalContext } = useViewModel();
  const wizard = useOpeningBalancesWizard(editing);
  const context = useJournalContext();
  const saving = useWizardSave(wizard.save, onSaved);

  function edit(patch: Partial<OpeningForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  return (
    <OpeningBalancesBody
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

export interface OpeningBalancesWizardProps extends WizardProps {
  /** The opening entry the wizard rewrites; null for a new opening. */
  editing: string | null;
}

/**
 * One step: the description, the "Transaction balance" with the search and
 * the "Show only rows with an amount" box, then the list of rows, each with
 * its Debit and its Credit. Enter or Tab in an amount moves to the next row's
 * Debit.
 */
function OpeningBalancesBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: OpeningBalancesBodyProps): ReactElement {
  const { form, summary } = state;
  const list = useRef<HTMLDivElement>(null);
  const balanced = summary.balance === ZERO_CENTS;

  function wordReason(reason: string): string {
    return reason === "not-an-amount" && summary.unreadableRow !== null
      ? `Enter an amount of zero or more for ${summary.unreadableRow}`
      : reasonText(reason);
  }

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  function editSearch(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ search: event.target.value });
  }

  function editOnlyWithAmount(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ onlyWithAmount: event.target.checked });
  }

  function editAmount(key: string, change: Partial<OpeningAmount>): void {
    const current = form.amounts[key] ?? { debit: "", credit: "" };

    onEdit({ amounts: { ...form.amounts, [key]: { ...current, ...change } } });
  }

  /** The next row's Debit takes the focus; past the last row, the key does what it always does. */
  function moveOn(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if ((event.key !== "Enter" && event.key !== "Tab") || event.shiftKey) {
      return;
    }

    const next = list.current?.querySelectorAll<HTMLInputElement>(
      'input[data-side="debit"]',
    )[index + 1];

    if (next !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      next.focus();
    }
  }

  return (
    <WizardDialog
      name="Opening Balances Entry"
      context={context}
      state={state}
      refusal={refusal}
      reasonText={wordReason}
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
      <div className="opening-tools">
        <span
          className="opening-balance"
          data-testid={TESTIDS.openingBalance}
          data-tone={balanced ? "zero" : "neg"}
        >
          Transaction balance
          <span className="opening-balance-amount">
            {formatCents(summary.balance)}
          </span>
        </span>
        <input
          type="search"
          className="opening-search"
          aria-label="Search accounts"
          placeholder="Search account…"
          value={form.search}
          onChange={editSearch}
        />
        <label className="opening-only">
          <input
            type="checkbox"
            checked={form.onlyWithAmount}
            onChange={editOnlyWithAmount}
          />
          Show only rows with an amount
        </label>
      </div>
      <div ref={list} className="wizard-lines opening-list">
        <div className="wizard-lines-head">
          <span>Account</span>
          <span className="wizard-amount-cell">Debit</span>
          <span className="wizard-amount-cell">Credit</span>
        </div>
        <div className="opening-rows">
          {summary.rows.length === 0 ? (
            <div className="opening-empty">No account matches.</div>
          ) : null}
          {summary.rows.map((row, index) => {
            return (
              <OpeningLine
                key={row.key}
                row={row}
                index={index}
                onAmount={editAmount}
                onKeyDown={moveOn}
              />
            );
          })}
        </div>
      </div>
    </WizardDialog>
  );
}

interface OpeningBalancesBodyProps {
  context: JournalContext | null;
  state: WizardState<OpeningForm, OpeningSummary>;
  refusal: string | null;
  onEdit: (patch: Partial<OpeningForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** A row of the list: its label, and its Debit and Credit as typed. */
function OpeningLine({
  row,
  index,
  onAmount,
  onKeyDown,
}: OpeningLineProps): ReactElement {
  function editDebit(event: ChangeEvent<HTMLInputElement>): void {
    onAmount(row.key, { debit: event.target.value });
  }

  function editCredit(event: ChangeEvent<HTMLInputElement>): void {
    onAmount(row.key, { credit: event.target.value });
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    onKeyDown(index, event);
  }

  return (
    <div className="wizard-lines-row" data-testid={TESTIDS.openingRow}>
      <span className="opening-label" title={row.label}>
        {row.label}
      </span>
      <span>
        <input
          className="wizard-input wizard-line-amount"
          inputMode="decimal"
          aria-label={`${row.label} debit`}
          data-side="debit"
          value={row.debit}
          onChange={editDebit}
          onKeyDown={keyDown}
        />
      </span>
      <span>
        <input
          className="wizard-input wizard-line-amount"
          inputMode="decimal"
          aria-label={`${row.label} credit`}
          data-side="credit"
          value={row.credit}
          onChange={editCredit}
          onKeyDown={keyDown}
        />
      </span>
    </div>
  );
}

interface OpeningLineProps {
  row: OpeningRowView;
  /** Its place among the rows shown. */
  index: number;
  onAmount: (key: string, change: Partial<OpeningAmount>) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
}
