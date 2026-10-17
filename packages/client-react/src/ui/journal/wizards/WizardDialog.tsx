import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

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
 * something, why the step cannot go on yet. An edit is titled "Edit {name}".
 * Next waits for the step's own verdict, Save for the whole one; Back shows
 * past the step the wizard starts at. Each step puts the focus on its first
 * field to fill, and Enter in a text field does what the primary button does
 * while it is enabled. Takes only props: the wizard that mounts it reads the
 * machine.
 */
export function WizardDialog({
  name,
  stepTitle,
  context,
  state,
  refusal,
  reasonText,
  shownInBody,
  onNext,
  onBack,
  onSave,
  onCancel,
  children,
}: WizardDialogProps): ReactElement {
  const body = useRef<HTMLDivElement>(null);
  const step = state.step;
  const named = state.editing === null ? name : `Edit ${name}`;
  const title =
    stepTitle === undefined ? named : `${named} — Step ${step}: ${stepTitle}`;

  const last = step === state.stepCount;
  const judged = last ? state.verdict : state.stepVerdict;
  const verdictReason =
    !judged.ok && state.touched && judged.reason !== shownInBody
      ? judged.reason
      : null;
  const reason = refusal ?? verdictReason;
  const canSave = state.verdict.ok && !state.saving;
  const canGoOn = state.stepVerdict.ok;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect reads the body's fields, which the step decides: each step must focus its own, so the step is what runs it again
  useEffect(() => {
    focusFirstField(body.current);
  }, [step]);

  function pressPrimary(): void {
    if (last && canSave) {
      onSave();
    } else if (!last && canGoOn) {
      onNext();
    }
  }

  return (
    <Dialog
      title={title}
      width="wizard"
      onClose={onCancel}
      onEnter={pressPrimary}
      footer={
        <>
          <span className="wizard-note">Required fields are marked with *</span>
          <span className="wizard-footer-spacer" />
          {step > state.firstStep ? (
            <button
              type="button"
              className="dialog-button"
              data-testid={TESTIDS.wizardBack}
              onClick={onBack}
            >
              ◀ Back
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className="dialog-button"
              data-primary="true"
              data-testid={TESTIDS.wizardSave}
              disabled={!canSave}
              onClick={onSave}
            >
              ✓ Save entry
            </button>
          ) : (
            <button
              type="button"
              className="dialog-button"
              data-primary="true"
              data-testid={TESTIDS.wizardNext}
              disabled={!canGoOn}
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
      <div ref={body} className="wizard-body">
        {children}
      </div>
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
  /** A verdict's reason the body already shows in its own place: the message leaves it out. A store's refusal always shows. */
  shownInBody?: string;
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

/**
 * Puts the focus on the step's first field to fill: the first required one
 * that is empty, else the first that is empty or required, else the first.
 * A field that cannot change is passed over; a group of radios is one field,
 * empty while none is chosen.
 */
function focusFirstField(root: HTMLElement | null): void {
  if (root === null) {
    return;
  }

  const fields = fieldsIn(root);
  const chosen =
    fields.find((field) => {
      return isRequired(field) && isEmpty(root, field);
    }) ??
    fields.find((field) => {
      return isRequired(field) || isEmpty(root, field);
    }) ??
    fields[0];

  chosen?.focus();
}

/** The controls the person can change, one per group of radios: its chosen radio, or its first. */
function fieldsIn(root: HTMLElement): HTMLElement[] {
  const controls = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    ),
  ).filter((control) => {
    return !control.disabled;
  });

  return controls.filter((control) => {
    if (!(control instanceof HTMLInputElement) || control.type !== "radio") {
      return true;
    }

    const group = radiosOf(root, control.name);
    const lead =
      group.find((radio) => {
        return radio.checked;
      }) ?? group[0];

    return lead === control;
  });
}

function isRequired(field: HTMLElement): boolean {
  return field.closest('[data-required="true"]') !== null;
}

/** A text or a select with nothing in it, or a group of radios with none chosen; a checkbox is never empty. */
function isEmpty(root: HTMLElement, field: HTMLElement): boolean {
  if (field instanceof HTMLSelectElement) {
    return field.value === "";
  }

  if (!(field instanceof HTMLInputElement) || field.type === "checkbox") {
    return false;
  }

  if (field.type === "radio") {
    return !radiosOf(root, field.name).some((radio) => {
      return radio.checked;
    });
  }

  return field.value.trim() === "";
}

function radiosOf(root: HTMLElement, name: string): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  ).filter((radio) => {
    return radio.name === name;
  });
}

/** A side of a preview line: a zero side is an empty cell. */
function sideOf(amount: Cents): Cents | null {
  return amount === ZERO_CENTS ? null : amount;
}
