import { NEVER } from "rxjs";

import {
  type Address,
  type Building,
  type BuildingDraft,
  type BuildingType,
  type OwnerParty,
  type Period,
  type PeriodDraft,
  type PeriodType,
  type RecordStatus,
  type Result,
  rejected,
  type Unit,
  validateAddress,
  validateBuilding,
  validatePeriod,
} from "@cl/domain";

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

/** What the Edit Building dialog's fields hold. */
interface BuildingDialogForm {
  name: string;
  code: string;
  status: RecordStatus;
  type: BuildingType;
  /** Set through the Address dialog; null for none. */
  address: Address | null;
  taxCode: string;
  /** As typed: `20/05/1980`, or `20/5` in the context's year; blank for none. */
  constructionDate: string;
  cadastralData: string;
  notes: string;
}

export interface BuildingDialogState
  extends FormDialogState<BuildingDialogForm> {
  /** The construction date as it reads, "YYYY-MM-DD"; null while blank or unreadable. */
  constructedOn: string | null;
  /** The id of the building the dialog edits. */
  editing: string;
}

/** What a building dialog is judged against: every building, the one edited, and the year a date typed without one is in. */
interface BuildingDialogContext {
  buildings: Building[];
  editing: Building;
  year: number;
}

/** What the Edit Management / Period dialog's fields hold. */
interface PeriodDialogForm {
  name: string;
  type: PeriodType;
  closed: boolean;
  /** As typed: `01/01/2013`, or `1/1` in the period's year. */
  start: string;
  end: string;
  notes: string;
}

export interface PeriodDialogState extends FormDialogState<PeriodDialogForm> {
  /** The start date as it reads, "YYYY-MM-DD"; null while blank or unreadable. */
  from: string | null;
  to: string | null;
  /** The id of the period the dialog edits. */
  editing: string;
}

/** What a period dialog is judged against: its building, the period, and the period's units and residents, whose own dates the new ones must hold. */
interface PeriodDialogContext {
  building: Building;
  period: Period;
  units: Unit[];
  residents: OwnerParty[];
}

/** What the Address dialog's fields hold. */
interface AddressDialogForm {
  street: string;
  postcode: string;
  city: string;
}

export type AddressDialogState = FormDialogState<AddressDialogForm>;

/**
 * The Edit Building dialog: a name and a code no other building has, its
 * status, type and address, and its profile. The name is required; the form
 * is judged as the port judges its write, the address too. A construction
 * date that reads as no date is `not-a-date`.
 */
export function createBuildingDialog(
  context: BuildingDialogContext,
  write: (draft: BuildingDraft) => Promise<Result>,
): Machine<BuildingDialogState, DialogIntents<BuildingDialogForm>> {
  const { buildings, editing, year } = context;

  function judge(form: BuildingDialogForm): Judgement<BuildingDraft> {
    const filled = form.name.trim() !== "";
    const constructionDate = dateOf(form.constructionDate, year);

    if (constructionDate === undefined) {
      return { verdict: rejected("not-a-date"), draft: null, filled };
    }

    const draft: BuildingDraft = {
      name: form.name.trim(),
      code: textOrNull(form.code),
      status: form.status,
      type: form.type,
      address: form.address,
      taxCode: textOrNull(form.taxCode),
      constructionDate,
      cadastralData: textOrNull(form.cadastralData),
      notes: textOrNull(form.notes),
    };

    const verdict = validateBuilding(draft, buildings, editing.id);

    return {
      verdict:
        verdict.ok && draft.address !== null
          ? validateAddress(draft.address)
          : verdict,
      draft,
      filled,
    };
  }

  return createFormDialog({
    initial: {
      name: editing.name,
      code: editing.code ?? "",
      status: editing.status,
      type: editing.type,
      address: editing.address,
      taxCode: editing.taxCode ?? "",
      constructionDate: dateText(editing.constructionDate),
      cadastralData: editing.cadastralData ?? "",
      notes: editing.notes ?? "",
    },
    fixed: [],
    judge,
    stateOf: (
      base: FormDialogState<BuildingDialogForm>,
    ): BuildingDialogState => {
      return {
        ...base,
        constructedOn: dateOrNull(base.form.constructionDate, year),
        editing: editing.id,
      };
    },
    write,
    rejudge$: NEVER,
  });
}

/**
 * The Edit Management / Period dialog: a name no other period of the
 * building has, its type, whether it is closed, its dates and notes. The
 * name and both dates are required. The dates may not cut a unit's or a
 * resident's own (`period-excludes`, naming the unit's code or the
 * resident); one blank or that reads as no date is `not-a-date`.
 */
export function createPeriodDialog(
  context: PeriodDialogContext,
  write: (draft: PeriodDraft) => Promise<Result>,
): Machine<PeriodDialogState, DialogIntents<PeriodDialogForm>> {
  const { building, period, units, residents } = context;
  const year = yearOf(period);

  function judge(form: PeriodDialogForm): Judgement<PeriodDraft> {
    const filled =
      form.name.trim() !== "" &&
      form.start.trim() !== "" &&
      form.end.trim() !== "";

    // Both dates are required: a blank one reads as no date.
    const start = dateOrNull(form.start, year);
    const end = dateOrNull(form.end, year);

    if (start === null || end === null) {
      return { verdict: rejected("not-a-date"), draft: null, filled };
    }

    const draft: PeriodDraft = {
      name: form.name.trim(),
      type: form.type,
      closed: form.closed,
      start,
      end,
      notes: textOrNull(form.notes),
    };

    return {
      verdict: validatePeriod(draft, building, period.id, units, residents),
      draft,
      filled,
    };
  }

  return createFormDialog({
    initial: {
      name: period.name,
      type: period.type,
      closed: period.closed,
      start: dateText(period.start),
      end: dateText(period.end),
      notes: period.notes ?? "",
    },
    fixed: [],
    judge,
    stateOf: (base: FormDialogState<PeriodDialogForm>): PeriodDialogState => {
      return {
        ...base,
        from: dateOrNull(base.form.start, year),
        to: dateOrNull(base.form.end, year),
        editing: period.id,
      };
    },
    write,
    rejudge$: NEVER,
  });
}

/**
 * The Address dialog: the street and number, required, the postcode and
 * the city. It writes no port: `write` hands the address to whatever opened
 * it, the building dialog's form.
 */
export function createAddressDialog(
  address: Address | null,
  write: (address: Address) => Promise<Result>,
): Machine<AddressDialogState, DialogIntents<AddressDialogForm>> {
  function judge(form: AddressDialogForm): Judgement<Address> {
    const draft: Address = {
      street: form.street.trim(),
      postcode: textOrNull(form.postcode),
      city: textOrNull(form.city),
    };

    return {
      verdict: validateAddress(draft),
      draft,
      filled: draft.street !== "",
    };
  }

  return createFormDialog({
    initial: {
      street: address?.street ?? "",
      postcode: address?.postcode ?? "",
      city: address?.city ?? "",
    },
    fixed: [],
    judge,
    stateOf: (base: AddressDialogState): AddressDialogState => {
      return base;
    },
    write,
    rejudge$: NEVER,
  });
}
