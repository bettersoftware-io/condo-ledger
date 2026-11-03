import { BehaviorSubject, type Observable, type Subscription } from "rxjs";

import {
  type Building,
  type BuildingsPort,
  type CalendarId,
  type CalendarPort,
  type DeadlineDraft,
  type DeadlinePriority,
  type DeadlineStatus,
  type ManualDeadline,
  type Result,
  validateDeadline,
} from "@cl/domain";

import {
  createFormDialog,
  type DialogIntents,
  dateOf,
  dateText,
  type FormDialogState,
  type Judgement,
  textOrNull,
} from "./formDialog.ts";
import type { Machine } from "./machine.ts";

/** What the Add and Edit Deadline dialog's fields hold. */
export interface DeadlineDialogForm {
  description: string;
  /** As typed: `05/02/2026`, or `5/2` in the clock's year. */
  date: string;
  /** As typed, `HH:MM`; blank for a deadline with no time of day. */
  time: string;
  calendar: CalendarId;
  buildingId: string | null;
  status: DeadlineStatus;
  priority: DeadlinePriority;
  notes: string;
}

/** The field a refusal belongs to. */
type DeadlineDialogField =
  | "description"
  | "date"
  | "time"
  | "calendar"
  | "buildingId";

export interface DeadlineDialogState
  extends FormDialogState<DeadlineDialogForm> {
  /** The id of the deadline the dialog edits; null for a new one. */
  editing: string | null;
  /** The field the verdict's refusal belongs to; null when it accepts. */
  field: DeadlineDialogField | null;
  /** The buildings to choose from, as the port gives them. */
  buildings: Building[];
}

/** Which deadline the dialog opens on: a new one on `day` (an ISO day) and the filter's building, or the one to edit as it stands. */
export type DeadlineDialogSpec =
  | { mode: "add"; day: string; buildingId: string | null }
  | { mode: "edit"; deadline: ManualDeadline };

/** What the dialog reads besides its ports: the year a date typed without one is in. */
interface DeadlineDialogContext {
  year: number;
}

/** What the dialog is built over. */
interface DeadlineDialogPorts {
  calendar: CalendarPort;
  buildings: BuildingsPort;
}

/**
 * The Add and Edit Deadline dialog. Judged as the port judges (the
 * description and the date are required). A new deadline opens on the day
 * given, the filter's building, the General calendar, New, no priority. A
 * saved deadline goes to `reveal` with its id and its day, so the Calendar
 * shows it; a refused save writes nothing and names the field.
 */
export function createDeadlineDialog(
  ports: DeadlineDialogPorts,
  context: DeadlineDialogContext,
  spec: DeadlineDialogSpec,
  reveal: (id: string, day: string) => void,
): Machine<DeadlineDialogState, DialogIntents<DeadlineDialogForm>> {
  const editing = spec.mode === "edit" ? spec.deadline : null;
  const buildings = hold<Building[]>(ports.buildings.buildings(), []);

  function judge(form: DeadlineDialogForm): Judgement<DeadlineDraft> {
    const draft: DeadlineDraft = {
      description: form.description.trim(),
      // A date that does not read is handed on as it is, for the rule to refuse.
      date: dateOf(form.date, context.year) ?? form.date.trim(),
      time: textOrNull(form.time),
      calendar: form.calendar,
      buildingId: form.buildingId,
      status: form.status,
      priority: form.priority,
      notes: textOrNull(form.notes),
    };

    return {
      verdict: validateDeadline(draft, buildings.get()),
      draft,
      filled: draft.description !== "" && form.date.trim() !== "",
    };
  }

  async function write(draft: DeadlineDraft): Promise<Result> {
    if (editing !== null) {
      const edited = await ports.calendar.editDeadline(editing.id, draft);

      if (edited.ok) {
        reveal(editing.id, draft.date);
      }

      return edited;
    }

    const added = await ports.calendar.addDeadline(draft);

    if (added.ok) {
      reveal(added.value.id, draft.date);
    }

    return added;
  }

  const machine = createFormDialog({
    initial: initialOf(spec),
    fixed: [],
    judge,
    stateOf: (
      base: FormDialogState<DeadlineDialogForm>,
    ): DeadlineDialogState => {
      return {
        ...base,
        editing: editing?.id ?? null,
        field: base.verdict.ok ? null : fieldOf(base.verdict.reason),
        buildings: buildings.get(),
      };
    },
    write,
    rejudge$: buildings.changed$,
  });

  return {
    ...machine,
    dispose: (): void => {
      machine.dispose();
      buildings.stop();
    },
  };
}

function initialOf(spec: DeadlineDialogSpec): DeadlineDialogForm {
  if (spec.mode === "add") {
    return {
      description: "",
      date: dateText(spec.day),
      time: "",
      calendar: "general",
      buildingId: spec.buildingId,
      status: "new",
      priority: "none",
      notes: "",
    };
  }

  const { deadline } = spec;

  return {
    description: deadline.description,
    date: dateText(deadline.date),
    time: deadline.time ?? "",
    calendar: deadline.calendar,
    buildingId: deadline.buildingId,
    status: deadline.status,
    priority: deadline.priority,
    notes: deadline.notes ?? "",
  };
}

/** The field a refusal's reason is shown on; a reason of the dialog's own (a save under way) belongs to none. */
function fieldOf(reason: string): DeadlineDialogField | null {
  switch (reason) {
    case "blank-description":
    case "description-too-long":
      return "description";
    case "bad-date":
      return "date";
    case "bad-time":
      return "time";
    case "books-calendar":
      return "calendar";
    case "unknown-building":
      return "buildingId";
    default:
      return null;
  }
}

/** What a read of a port holds now, and tells when it changes. */
interface Held<TValue> {
  get: () => TValue;
  changed$: Observable<TValue>;
  stop: () => void;
}

function hold<TValue>(
  source$: Observable<TValue>,
  initial: TValue,
): Held<TValue> {
  const value$ = new BehaviorSubject<TValue>(initial);
  const subscription: Subscription = source$.subscribe((value) => {
    value$.next(value);
  });

  return {
    get: (): TValue => {
      return value$.getValue();
    },
    changed$: value$.asObservable(),
    stop: (): void => {
      subscription.unsubscribe();
      value$.complete();
    },
  };
}
