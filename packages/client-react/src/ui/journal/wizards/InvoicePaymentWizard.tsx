import { Landmark } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import type {
  InvoicePaymentForm,
  InvoicePaymentSummary,
  JournalContext,
  WizardState,
} from "@cl/client-core";
import { ZERO_CENTS } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { useLocale } from "#/ui/amountLocale.ts";
import { FormField } from "#/ui/FormField.tsx";
import { formatCents } from "#/ui/format.ts";
import { SelectableList } from "#/ui/SelectableList.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { OpenInvoicesGrid } from "./OpenInvoicesGrid.tsx";
import { PAYMENT_REASONS, reasonText } from "./reasons.ts";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the Invoice payment wizard, new or editing a payment, and hands its body plain props. */
export function InvoicePaymentWizard({
  editing,
  onSaved,
  onCancel,
}: InvoicePaymentWizardProps): ReactElement {
  const { useInvoicePaymentWizard, useJournalContext } = useViewModel();
  const wizard = useInvoicePaymentWizard(editing);
  const context = useJournalContext();
  const saving = useWizardSave(wizard, onSaved);

  return (
    <InvoicePaymentBody
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

export interface InvoicePaymentWizardProps extends WizardProps {
  /** The payment entry the wizard rewrites; null for a new payment. */
  editing: string | null;
}

/** The design's three steps: the invoice, the liquidity account and the amount, the description. */
function InvoicePaymentBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: InvoicePaymentBodyProps): ReactElement {
  const { form, summary } = state;
  const locale = useLocale();
  const accounts = state.choices.map((choice) => {
    return {
      key: choice.key,
      label: choice.label,
      icon: <Landmark size={13} />,
    };
  });

  function wordReason(reason: string): string {
    return reason === "over-remaining"
      ? `The invoice still owes ${formatCents(summary.remaining ?? ZERO_CENTS, locale)}.`
      : reasonText(reason, PAYMENT_REASONS);
  }

  function editInvoice(invoiceId: string): void {
    onEdit({ invoiceId });
  }

  function editAccount(accountId: string): void {
    onEdit({ accountId });
  }

  function editAmount(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ amount: event.target.value });
  }

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  return (
    <WizardDialog
      name="Invoice Payment"
      stepTitle={STEP_TITLES[state.step - 1]}
      context={context}
      state={state}
      refusal={refusal}
      reasonText={wordReason}
      onNext={onNext}
      onBack={onBack}
      onSave={onSave}
      onCancel={onCancel}
    >
      {state.step === 1 ? (
        <OpenInvoicesGrid
          rows={summary.open}
          selectedId={form.invoiceId}
          onSelect={editInvoice}
        />
      ) : null}
      {state.step === 2 ? (
        <>
          <SelectableList
            label="SELECT A MOVABLE LIQUIDITY ACCOUNT"
            items={accounts}
            selectedKey={form.accountId}
            onSelect={editAccount}
          />
          <p className="wizard-hint" data-testid={TESTIDS.wizardTrancheNote}>
            You may pay an invoice in several tranches: enter an amount lower
            than the invoice total to settle it partially; the remainder can be
            paid later.
          </p>
          <FormField label="Amount to pay" required>
            <input
              aria-required="true"
              className="wizard-input wizard-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={editAmount}
            />
          </FormField>
        </>
      ) : null}
      {state.step === 3 ? (
        <FormField label="Description" required>
          <input
            aria-required="true"
            className="wizard-input"
            value={form.description}
            onChange={editDescription}
          />
        </FormField>
      ) : null}
    </WizardDialog>
  );
}

interface InvoicePaymentBodyProps {
  context: JournalContext | null;
  state: WizardState<InvoicePaymentForm, InvoicePaymentSummary>;
  refusal: string | null;
  /** Carries only the field that changed: a patch naming the amount or the description stops its prefill. */
  onEdit: (patch: Partial<InvoicePaymentForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const STEP_TITLES: readonly string[] = [
  "Select invoice",
  "Liquidity account and amount",
  "Description",
];
