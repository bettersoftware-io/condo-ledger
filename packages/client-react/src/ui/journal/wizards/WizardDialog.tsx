import type { ReactElement, ReactNode } from "react";

import type { JournalContext, WizardState } from "@cl/client-core";
import { type Cents, ZERO_CENTS } from "@cl/domain";

import { Dialog } from "#/ui/Dialog.tsx";
import { FormField } from "#/ui/FormField.tsx";
import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import "./Wizards.css";

/**
 * Any wizard's dialog: the building and period first, the step's body, then
 * the "Entry postings" the draft would write and, once the person has edited
 * something, why it cannot be saved yet. Takes only props: the wizard that
 * mounts it reads the machine.
 */
export function WizardDialog({
  name,
  stepTitle,
  context,
  state,
  refusal,
  reasonText,
  onNext,
  onBack,
  onSave,
  onCancel,
  children,
}: WizardDialogProps): ReactElement {
  const title =
    stepTitle === undefined
      ? name
      : `${name} — Step ${state.step}: ${stepTitle}`;

  const reason =
    refusal ??
    (!state.verdict.ok && state.touched ? state.verdict.reason : null);
  const last = state.step === state.stepCount;

  return (
    <Dialog
      title={title}
      width="wizard"
      onClose={onCancel}
      footer={
        <>
          <span className="wizard-note">Required fields are marked with *</span>
          <span className="wizard-footer-spacer" />
          {state.step > 1 ? (
            <button type="button" className="dialog-button" onClick={onBack}>
              ◀ Back
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className="dialog-button"
              data-primary="true"
              data-testid={TESTIDS.wizardSave}
              disabled={!state.verdict.ok || state.saving}
              onClick={onSave}
            >
              ✓ Save entry
            </button>
          ) : (
            <button
              type="button"
              className="dialog-button"
              data-primary="true"
              disabled={!state.verdict.ok}
              onClick={onNext}
            >
              Next ▶
            </button>
          )}
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.wizardCancel}
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        </>
      }
    >
      <FormField label="Building / Period" readOnly>
        {context === null ? "" : `${context.building} / ${context.period}`}
      </FormField>
      {children}
      <div className="wizard-section">
        <div className="wizard-section-label">Entry postings</div>
        <div className="wizard-preview">
          <div className="wizard-preview-head">
            <span>#</span>
            <span>Account (Partita)</span>
            <span className="wizard-amount-cell">Debit</span>
            <span className="wizard-amount-cell">Credit</span>
          </div>
          {state.preview.map((line, index) => {
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: a preview line is its position: the draft's postings in order, with no identity of their own
                key={index}
                className="wizard-preview-row"
                data-testid={TESTIDS.wizardPreviewRow}
              >
                <span>{index + 1}</span>
                <span className="wizard-path">{line.path}</span>
                <span className="wizard-amount-cell">
                  <Money cents={sideOf(line.debit)} variant="plain" />
                </span>
                <span className="wizard-amount-cell">
                  <Money cents={sideOf(line.credit)} variant="plain" />
                </span>
              </div>
            );
          })}
        </div>
        {reason === null ? null : (
          <div className="wizard-message" data-testid={TESTIDS.wizardMessage}>
            {reasonText(reason)}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export interface WizardDialogProps {
  /** The wizard's title, as the design names it. */
  name: string;
  /** The step's own title, for a wizard of several steps; a one-step wizard shows its name alone. */
  stepTitle?: string;
  context: JournalContext | null;
  state: WizardState<unknown, unknown>;
  /** Why the journal store refused the last save; null when it did not. Shown in place of the verdict's reason. */
  refusal: string | null;
  /** The wizard's own words for a reason. */
  reasonText: (reason: string) => string;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
  /** The step's body. */
  children: ReactNode;
}

/** What every wizard on the Journal screen takes: where a saved entry goes, and how it closes. */
export interface WizardProps {
  /** The entry is written: its id. */
  onSaved: (id: string) => void;
  onCancel: () => void;
}

/** A side of a preview line: a zero side is an empty cell. */
function sideOf(amount: Cents): Cents | null {
  return amount === ZERO_CENTS ? null : amount;
}
