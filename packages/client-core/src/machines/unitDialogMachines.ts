import { NEVER } from "rxjs";

import {
  type Address,
  type Cents,
  cents,
  type GroupDraft,
  type OwnerParty,
  type PeriodDates,
  type ResidencyDraft,
  type Restriction,
  type Result,
  rejected,
  spanOf,
  type Unit,
  type UnitDraft,
  type UnitGroup,
  type UnitType,
  validateGroup,
  validateResidency,
  validateUnit,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import type { AmountTexts } from "#/amounts.ts";

import {
  createFormDialog,
  type DialogIntents,
  dateOf,
  dateOrNull,
  dateText,
  type FormDialogState,
  type Judgement,
  textOrNull,
  yearOf,
} from "./formDialog.ts";
import type { Machine } from "./machine.ts";

/** What the New and Edit Group dialogs' fields hold. */
interface GroupDialogForm {
  code: string;
  name: string;
  /** Set through the Address dialog; null for none. */
  address: Address | null;
  notes: string;
}

export interface GroupDialogState extends FormDialogState<GroupDialogForm> {
  /** The id of the group the dialog edits; null for a new one. */
  editing: string | null;
}

/** What a group dialog is judged against: the period's groups and the parent it saves under. */
interface GroupDialogContext {
  groups: UnitGroup[];
  /** The new group's parent, or the edited group's own: it never changes. */
  parentId: string | null;
  editing: UnitGroup | null;
}

/** What the New and Edit Unit dialogs' fields hold. */
interface UnitDialogForm {
  code: string;
  name: string;
  floor: string;
  interior: string;
  subUnit: string;
  /** As typed: `19/01/2013`, or `19/1` in the period's year; blank for none. */
  start: string;
  end: string;
  type: UnitType;
  cadastralData: string;
  notes: string;
}

export interface UnitDialogState extends FormDialogState<UnitDialogForm> {
  /** The start date as it reads, "YYYY-MM-DD"; null while blank or unreadable. */
  from: string | null;
  to: string | null;
  editing: string | null;
}

/** What a unit dialog is judged against: the period's units, residents and dates. */
interface UnitDialogContext {
  units: Unit[];
  /** The period's residents: the edited unit's dates may not cut theirs. */
  residents: OwnerParty[];
  period: PeriodDates;
  editing: Unit | null;
}

/** What the Add and Edit Owner dialogs' fields hold. */
interface OwnerDialogForm {
  contactId: string | null;
  role: ResidencyDraft["role"];
  /** As typed, in the session's locale. */
  previousBalance: string;
  start: string;
  end: string;
}

export interface OwnerDialogState extends FormDialogState<OwnerDialogForm> {
  from: string | null;
  to: string | null;
  /** The unit's dates, else the period's: the residency's own must lie within them. */
  unitDates: PeriodDates;
  /** The stored co-ownership percentage, in ten-thousandths of a percent; null when empty, and on a new owner. */
  share: number | null;
  /** True once the period's opening entry is posted: the balance is the journal's, 0 on a new owner. */
  balanceLocked: boolean;
  /** The id of the resident the dialog edits; null for a new one. */
  editing: string | null;
}

/** What an owner dialog is judged against: the unit, the period's residents and dates, and whether the opening entry is posted. */
interface OwnerDialogContext {
  unit: Unit;
  residents: OwnerParty[];
  period: PeriodDates;
  openingPosted: boolean;
  editing: OwnerParty | null;
}

/**
 * The New and Edit Group dialog: a code and a name no sibling has, the
 * address and the notes. Code and name are required; the form is judged by
 * `validateGroup` before the write.
 */
export function createGroupDialog(
  context: GroupDialogContext,
  write: (draft: GroupDraft) => Promise<Result>,
): Machine<GroupDialogState, DialogIntents<GroupDialogForm>> {
  const { groups, parentId, editing } = context;
  const editingId = editing?.id ?? null;

  function judge(form: GroupDialogForm): Judgement<GroupDraft> {
    const draft: GroupDraft = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address,
      notes: textOrNull(form.notes),
    };

    return {
      verdict: validateGroup(draft, parentId, groups, editingId),
      draft,
      filled: draft.code !== "" && draft.name !== "",
    };
  }

  return createFormDialog({
    initial:
      editing === null
        ? { code: "", name: "", address: null, notes: "" }
        : {
            code: editing.code,
            name: editing.name,
            address: editing.address,
            notes: editing.notes ?? "",
          },
    fixed: [],
    judge,
    stateOf: (base: FormDialogState<GroupDialogForm>): GroupDialogState => {
      return { ...base, editing: editingId };
    },
    write,
    rejudge$: NEVER,
  });
}

/**
 * The New and Edit Unit dialog: a code no other unit of the period has, the
 * unit's own dates within the period, its type and its profile. The code is
 * required; a new unit is an apartment. Dates are typed as day/month/year,
 * and one that reads as no date is `not-a-date`.
 */
export function createUnitDialog(
  context: UnitDialogContext,
  write: (draft: UnitDraft) => Promise<Result>,
): Machine<UnitDialogState, DialogIntents<UnitDialogForm>> {
  const { units, residents, period, editing } = context;
  const editingId = editing?.id ?? null;
  const year = yearOf(period);

  function judge(form: UnitDialogForm): Judgement<UnitDraft> {
    const filled = form.code.trim() !== "";
    const restriction = restrictionOf(form.start, form.end, year);

    if (restriction === undefined) {
      return { verdict: rejected("not-a-date"), draft: null, filled };
    }

    const draft: UnitDraft = {
      code: form.code.trim(),
      name: textOrNull(form.name),
      floor: textOrNull(form.floor),
      interior: textOrNull(form.interior),
      subUnit: textOrNull(form.subUnit),
      restriction,
      type: form.type,
      cadastralData: textOrNull(form.cadastralData),
      notes: textOrNull(form.notes),
    };

    return {
      verdict: validateUnit(draft, units, residents, period, editingId),
      draft,
      filled,
    };
  }

  return createFormDialog({
    initial: editing === null ? BLANK_UNIT : unitFormOf(editing),
    fixed: [],
    judge,
    stateOf: (base: FormDialogState<UnitDialogForm>): UnitDialogState => {
      return {
        ...base,
        from: dateOrNull(base.form.start, year),
        to: dateOrNull(base.form.end, year),
        editing: editingId,
      };
    },
    write,
    rejudge$: NEVER,
  });
}

/**
 * The Add and Edit Owner dialog on one unit: the linked contact, the role,
 * the previous balance and the residency's own dates. The contact and the
 * balance are required; on an edit the contact and the role stay as they
 * are. Once the period's opening entry is posted the balance stays too: the
 * resident's own on an edit, 0 on an add. The balance is read in the
 * session's locale as it stands, and judged again when it changes; one that
 * does not read is `not-an-amount`.
 */
export function createOwnerDialog(
  texts: AmountTexts,
  context: OwnerDialogContext,
  write: (draft: ResidencyDraft) => Promise<Result>,
): Machine<OwnerDialogState, DialogIntents<OwnerDialogForm>> {
  const { unit, residents, period, openingPosted, editing } = context;
  const editingId = editing?.id ?? null;
  const year = yearOf(period);
  const lockedBalance = editing?.startingBalance ?? cents(0);

  function judge(form: OwnerDialogForm): Judgement<ResidencyDraft> {
    const filled =
      form.contactId !== null &&
      (openingPosted || form.previousBalance.trim() !== "");

    const startingBalance: Cents | null = openingPosted
      ? lockedBalance
      : texts.parse(form.previousBalance);

    if (startingBalance === null) {
      return { verdict: rejected("not-an-amount"), draft: null, filled };
    }

    const ownRestriction = restrictionOf(form.start, form.end, year);

    if (ownRestriction === undefined) {
      return { verdict: rejected("not-a-date"), draft: null, filled };
    }

    const draft: ResidencyDraft = {
      contactId: form.contactId,
      role: form.role,
      startingBalance,
      ownRestriction,
    };

    return {
      verdict: validateResidency(draft, unit, residents, period, editingId),
      draft,
      filled,
    };
  }

  return createFormDialog({
    initial: {
      contactId: editing?.personId ?? null,
      role: editing === null ? "PR" : roleOf(editing.role),
      previousBalance:
        editing === null && !openingPosted ? "" : texts.text(lockedBalance),
      start: dateText(editing?.ownRestriction?.from ?? null),
      end: dateText(editing?.ownRestriction?.to ?? null),
    },
    fixed: [
      ...(editing === null ? [] : (["contactId", "role"] as const)),
      ...(openingPosted ? (["previousBalance"] as const) : []),
    ],
    judge,
    stateOf: (base: FormDialogState<OwnerDialogForm>): OwnerDialogState => {
      return {
        ...base,
        from: dateOrNull(base.form.start, year),
        to: dateOrNull(base.form.end, year),
        unitDates: spanOf(unit.restriction, period),
        share: editing?.share ?? null,
        balanceLocked: openingPosted,
        editing: editingId,
      };
    },
    write,
    rejudge$: texts.changed$,
  });
}

const BLANK_UNIT: UnitDialogForm = {
  code: "",
  name: "",
  floor: "",
  interior: "",
  subUnit: "",
  start: "",
  end: "",
  type: "apartment",
  cadastralData: "",
  notes: "",
};

function unitFormOf(unit: Unit): UnitDialogForm {
  return {
    code: unit.code,
    name: unit.name ?? "",
    floor: unit.floor ?? "",
    interior: unit.interior ?? "",
    subUnit: unit.subUnit ?? "",
    start: dateText(unit.restriction?.from ?? null),
    end: dateText(unit.restriction?.to ?? null),
    type: unit.type,
    cadastralData: unit.cadastralData ?? "",
    notes: unit.notes ?? "",
  };
}

const ROLES: readonly ResidencyDraft["role"][] = ["PR", "CO", "SC"];

/** The stored role as the dialog offers it; throws for one it does not offer. */
function roleOf(role: string): ResidencyDraft["role"] {
  return must(
    ROLES.find((candidate) => {
      return candidate === role;
    }),
    `the role ${role}`,
  );
}

/** The two dates as a restriction: null when both are blank, undefined when one does not read. */
function restrictionOf(
  start: string,
  end: string,
  year: number,
): Restriction | null | undefined {
  const from = dateOf(start, year);
  const to = dateOf(end, year);

  if (from === undefined || to === undefined) {
    return undefined;
  }

  return from === null && to === null ? null : { from, to };
}
