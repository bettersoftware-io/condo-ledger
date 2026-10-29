import { Landmark } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import type {
  CollectionForm,
  CollectionSummary,
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

import { OwnersGrid } from "./OwnersGrid.tsx";
import { COLLECTION_REASONS, reasonText } from "./reasons.ts";
import { SettlementTable } from "./SettlementTable.tsx";
import { useWizardSave } from "./useWizardSave.ts";
import { WizardDialog, type WizardProps } from "./WizardDialog.tsx";

/** Reads the Record owner collection wizard, new or editing a collection, and hands its body plain props. */
export function CollectionWizard({
  editing,
  onSaved,
  onCancel,
}: CollectionWizardProps): ReactElement {
  const { useCollectionWizard, useJournalContext } = useViewModel();
  const wizard = useCollectionWizard(editing);
  const context = useJournalContext();
  const saving = useWizardSave(wizard, onSaved);

  return (
    <CollectionBody
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

export interface CollectionWizardProps extends WizardProps {
  /** The collection the wizard rewrites; null for a new one. */
  editing: string | null;
}

/** The three steps: the owner, the liquidity account and the amount with what it settles, the description. */
function CollectionBody({
  context,
  state,
  refusal,
  onEdit,
  onNext,
  onBack,
  onSave,
  onCancel,
}: CollectionBodyProps): ReactElement {
  const { form, summary } = state;
  const locale = useLocale();
  const accounts = state.choices.map((choice) => {
    return {
      key: choice.key,
      label: choice.label,
      icon: <Landmark size={13} />,
    };
  });

  /**
   * Above what the owner owes: what they owe now, in all. A store's refusal
   * for an item paid meanwhile says the same while the amount is still above
   * it; once the amount fits, the settlement has been worked out again.
   */
  function wordReason(reason: string): string {
    const aboveOwed = !state.verdict.ok && state.verdict.reason === "over-owed";

    return reason === "over-owed" ||
      (reason === "over-remaining-item" && aboveOwed)
      ? `${summary.person ?? "The owner"} owes ${formatCents(summary.owed ?? ZERO_CENTS, locale)} in all.`
      : reasonText(reason, COLLECTION_REASONS);
  }

  function editPerson(personId: string): void {
    onEdit({ personId });
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
      name="Record Owner Collection"
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
        <OwnersGrid
          rows={summary.people}
          selectedId={form.personId}
          onSelect={editPerson}
        />
      ) : null}
      {state.step === 2 ? (
        <>
          <SelectableList
            label="LIQUIDITY ACCOUNT COLLECTED INTO"
            items={accounts}
            selectedKey={form.accountId}
            onSelect={editAccount}
          />
          <FormField label="Amount collected" required>
            <input
              aria-required="true"
              className="wizard-input wizard-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={editAmount}
            />
          </FormField>
          <p className="wizard-hint" data-testid={TESTIDS.collectionHint}>
            The amount is allocated against the owner's outstanding
            installments, oldest first.
          </p>
          <SettlementTable rows={summary.settlement} />
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

interface CollectionBodyProps {
  context: JournalContext | null;
  state: WizardState<CollectionForm, CollectionSummary>;
  refusal: string | null;
  /** Carries only the field that changed: a patch naming the amount or the description stops its prefill. */
  onEdit: (patch: Partial<CollectionForm>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const STEP_TITLES: readonly string[] = [
  "Choose an owner",
  "Amount and liquidity account",
  "Description",
];
