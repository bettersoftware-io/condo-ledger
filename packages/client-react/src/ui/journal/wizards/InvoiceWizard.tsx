import type { ChangeEvent, ReactElement } from "react";

import {
  type InvoiceForm,
  type InvoicePreset,
  type InvoiceSummary,
  type JournalContext,
  SUPPLIER_GROUP,
  WITHHOLDING_GROUP,
  type WizardChoice,
  type WizardState,
} from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { useLocale } from "#/ui/amountLocale.ts";
import { DateField } from "#/ui/DateField.tsx";
import { FormField } from "#/ui/FormField.tsx";
import { formatCents } from "#/ui/format.ts";
import {
  SegmentedControl,
  type SegmentOption,
} from "#/ui/SegmentedControl.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { ChoiceSelect } from "./ChoiceSelect.tsx";
import { InvoiceCalcRow } from "./InvoiceCalcRow.tsx";
import { INVOICE_REASONS, reasonText } from "./reasons.ts";
import { SupplierSelect } from "./SupplierSelect.tsx";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

import "./InvoiceWizard.css";

/** Reads the New invoice wizard, new or editing an invoice's registration, and hands its body plain props. */
export function InvoiceWizard({
  editing,
  onSaved,
  onCancel,
}: InvoiceWizardProps): ReactElement {
  const { useInvoiceWizard, useJournalContext } = useViewModel();
  const wizard = useInvoiceWizard(editing);
  const context = useJournalContext();
  const saving = useWizardSave(wizard.save, onSaved);

  function edit(patch: Partial<InvoiceForm>): void {
    saving.forget();
    wizard.edit(patch);
  }

  return (
    <InvoiceBody
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

export interface InvoiceWizardProps extends WizardProps {
  /** The invoice entry the wizard rewrites; null for a new invoice. */
  editing: string | null;
}

/** The design's two steps: the supplier and the invoice's particulars, then the withholding computed. */
function InvoiceBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: InvoiceBodyProps): ReactElement {
  const { summary } = state;
  const locale = useLocale();

  function wordReason(reason: string): string {
    return reason === "below-paid"
      ? `Payments already made total ${formatCents(summary.paid, locale)}.`
      : reasonText(reason, INVOICE_REASONS);
  }

  return (
    <WizardDialog
      name="New Invoice Entry"
      stepTitle={state.step === 1 ? "Select supplier" : "Calculate withholding"}
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
        <SupplierStep
          form={state.form}
          summary={summary}
          choices={state.choices}
          onEdit={onEdit}
        />
      ) : (
        <WithholdingStep
          form={state.form}
          summary={summary}
          choices={state.choices}
          onEdit={onEdit}
        />
      )}
    </WizardDialog>
  );
}

interface InvoiceBodyProps {
  context: JournalContext | null;
  state: WizardState<InvoiceForm, InvoiceSummary>;
  refusal: string | null;
  /** Carries only the fields that changed: a field named here is the person's from now on. */
  onEdit: (patch: Partial<InvoiceForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Step 1: the supplier, the number (warned when the supplier has it already), the reason, the cost account, the dates. */
function SupplierStep({
  form,
  summary,
  choices,
  onEdit,
}: InvoiceStepProps): ReactElement {
  const suppliers = choices.filter((choice) => {
    return choice.group === SUPPLIER_GROUP;
  });

  const costAccounts = choices.filter((choice) => {
    return (
      choice.group !== SUPPLIER_GROUP && choice.group !== WITHHOLDING_GROUP
    );
  });

  const supplier = suppliers.find((choice) => {
    return choice.key === form.supplierId;
  });

  function editSupplier(supplierId: string | null): void {
    onEdit({ supplierId });
  }

  function editNumber(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ number: event.target.value });
  }

  function editReason(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ reason: event.target.value });
  }

  function editCostAccount(costAccountId: string | null): void {
    onEdit({ costAccountId });
  }

  function editDate(date: string): void {
    onEdit({ date });
  }

  function editDueDate(dueDate: string): void {
    onEdit({ dueDate });
  }

  return (
    <>
      <SupplierSelect
        choices={suppliers}
        value={form.supplierId}
        locked={summary.supplierLocked}
        note={summary.supplierLocked ? LOCKED_NOTE : undefined}
        onChange={editSupplier}
      />
      <div className="wizard-field-with-note">
        <FormField label="Invoice number" required>
          <input
            className="wizard-input"
            value={form.number}
            onChange={editNumber}
          />
        </FormField>
        {summary.duplicate && supplier !== undefined ? (
          <p
            className="wizard-field-note"
            data-testid={TESTIDS.invoiceDuplicate}
          >
            {`${supplier.label} already has an invoice ${form.number.trim()} in this period.`}
          </p>
        ) : null}
      </div>
      <FormField label="Invoice reason" required>
        <input
          className="wizard-input"
          value={form.reason}
          onChange={editReason}
        />
      </FormField>
      <FormField label="Cost account" required>
        <ChoiceSelect
          label="Cost account"
          choices={costAccounts}
          value={form.costAccountId}
          onChoose={editCostAccount}
        />
      </FormField>
      <DateField
        label="Invoice date"
        required
        value={form.date}
        parsed={summary.date}
        onChange={editDate}
      />
      <DateField
        label="Invoice due date"
        value={form.dueDate}
        parsed={summary.dueDate}
        onChange={editDueDate}
      />
    </>
  );
}

/** Step 2: the pill, the amounts and rates the person types, and every amount they imply, down to what is due to the supplier. */
function WithholdingStep({
  form,
  summary,
  choices,
  onEdit,
}: InvoiceStepProps): ReactElement {
  const { totals } = summary;
  const withholdings = choices.filter((choice) => {
    return choice.group === WITHHOLDING_GROUP;
  });

  function editPreset(preset: InvoicePreset): void {
    onEdit({ preset });
  }

  function editTaxable(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ taxable: event.target.value });
  }

  function editSocialSecurity(text: string): void {
    onEdit({ socialSecurityRate: text });
  }

  function editVat(text: string): void {
    onEdit({ vatRate: text });
  }

  function editNonTaxable(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ nonTaxable: event.target.value });
  }

  function editOnSocialSecurity(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ withholdingOnSocialSecurity: event.target.checked });
  }

  function editWithholding(withholdingCode: string | null): void {
    onEdit({ withholdingCode });
  }

  function editDescription(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ description: event.target.value });
  }

  return (
    <div className="invoice-calc">
      <div className="wizard-section">
        <div className="wizard-section-label">Withholding type</div>
        <SegmentedControl
          label="Withholding type"
          options={PRESETS}
          value={form.preset}
          onChange={editPreset}
        />
      </div>
      <FormField label="Taxable amount" required>
        <input
          className="wizard-input wizard-amount"
          inputMode="decimal"
          value={form.taxable}
          onChange={editTaxable}
        />
      </FormField>
      <InvoiceCalcRow
        label="Social security withholding"
        rate={{ text: form.socialSecurityRate, onChange: editSocialSecurity }}
        amount={totals?.socialSecurity ?? null}
      />
      <InvoiceCalcRow
        label="Invoice taxable"
        amount={totals?.invoiceTaxable ?? null}
      />
      <InvoiceCalcRow
        label="Total VAT"
        rate={{ text: form.vatRate, onChange: editVat }}
        amount={totals?.vat ?? null}
      />
      {summary.nonTaxableShown ? (
        <FormField label="Non-taxable amount">
          <input
            className="wizard-input wizard-amount"
            inputMode="decimal"
            value={form.nonTaxable}
            onChange={editNonTaxable}
          />
        </FormField>
      ) : null}
      <InvoiceCalcRow
        label="Total invoice"
        amount={totals?.total ?? null}
        strong
      />
      <label className="invoice-check">
        <input
          type="checkbox"
          checked={form.withholdingOnSocialSecurity}
          onChange={editOnSocialSecurity}
        />
        Apply withholding on social security
      </label>
      <InvoiceCalcRow
        label="Withholding taxable"
        amount={totals?.withholdingBase ?? null}
      />
      <InvoiceCalcRow
        label="Withholding tax"
        control={
          <ChoiceSelect
            label="Withholding tax"
            choices={withholdings}
            value={form.withholdingCode}
            onChoose={editWithholding}
            placeholder="No withholding"
          />
        }
        amount={totals?.withholding ?? null}
      />
      <InvoiceCalcRow
        label="Total due to supplier"
        amount={totals?.dueToSupplier ?? null}
        strong
      />
      <FormField label="Description" required>
        <input
          className="wizard-input"
          value={form.description}
          onChange={editDescription}
        />
      </FormField>
    </div>
  );
}

interface InvoiceStepProps {
  form: InvoiceForm;
  summary: InvoiceSummary;
  /** The suppliers, the cost accounts and the withholding codes, told apart by their group. */
  choices: WizardChoice[];
  onEdit: (patch: Partial<InvoiceForm>) => void;
}

/** The note under a locked supplier. */
const LOCKED_NOTE = "This invoice has payments: its supplier cannot change.";

/** The design's four pills, in its order. */
const PRESETS: readonly SegmentOption<InvoicePreset>[] = [
  { value: "company", label: "Company" },
  { value: "professionalWithRegister", label: "Professional w/ register" },
  {
    value: "professionalWithoutRegister",
    label: "Professional w/o register",
  },
  { value: "nonSubject", label: "With non-subject amounts" },
];
