import {
  BehaviorSubject,
  merge,
  NEVER,
  type Observable,
  type Subscription,
} from "rxjs";

import {
  type Address,
  type BuildingsPort,
  type ConnectionDraft,
  type Contact,
  type ContactCategory,
  type ContactConnection,
  type ContactDraft,
  type ContactRowDraft,
  type ContactRowType,
  type ContactsPort,
  nameOf,
  ok,
  type RecordStatus,
  type Result,
  type SupplierLink,
  validateCategory,
  validateConnection,
  validateContact,
  validateContactRow,
  validateSupplier,
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

/** What the New and Edit Person and Company dialogs' fields hold; a company ignores the person's, a person the company's. */
interface ContactDialogForm {
  status: RecordStatus;
  code: string;
  firstName: string;
  lastName: string;
  gender: "m" | "f" | null;
  /** As typed: `20/05/1980`, or `20/5` in the clock's year; blank for none. */
  birthDate: string;
  birthPlace: string;
  /** The addresses are set through the Address dialog; null for none. */
  officeAddress: Address | null;
  residenceAddress: Address | null;
  domicileAddress: Address | null;
  companyName: string;
  registeredOffice: Address | null;
  taxDomicile: Address | null;
  salutation: string | null;
  taxCode: string;
  vatNumber: string;
  categoryId: string | null;
  postalAddress: Address | null;
  language: "it" | "en" | null;
  notes: string;
  /** Held until the contact is saved: the whole draft is written in one call. */
  rows: ContactRowDraft[];
}

export interface ContactDialogState extends FormDialogState<ContactDialogForm> {
  /** Fixed once the contact exists. */
  kind: "person" | "company";
  /** The id of the contact the dialog edits; null for a new one. */
  editing: string | null;
  /** The salutations to choose from, the most used first. */
  salutations: string[];
  /** The order of a row added now: the highest held plus one, 1 for none. */
  nextOrder: number;
}

export interface ContactDialogIntents extends DialogIntents<ContactDialogForm> {
  /** Removes the row at `index` of the form's rows. */
  removeRow: (index: number) => void;
  /** Appends the row when `index` is null, else replaces the row at `index`. */
  applyRow: (index: number | null, row: ContactRowDraft) => void;
}

/** Which contact the dialog opens on: a new one of this kind, or the contact to edit (whose own kind holds). */
export interface ContactDialogSpec {
  kind: "person" | "company";
  editing: Contact | null;
}

/** What a contact dialog reads besides its ports: the year a date typed without one is in. */
interface ContactDialogContext {
  year: number;
}

/** What the Add and Edit Contact (row) dialog's fields hold. */
interface ContactRowDialogForm {
  /** As typed. */
  order: string;
  type: ContactRowType;
  label: string;
  value: string;
}

export type ContactRowDialogState = FormDialogState<ContactRowDialogForm>;

/** What the New and Edit Category dialog's fields hold. */
interface CategoryDialogForm {
  name: string;
}

export interface CategoryDialogState
  extends FormDialogState<CategoryDialogForm> {
  /** The id of the category the dialog edits; null for a new one. */
  editing: string | null;
}

/** What the Add and Edit Connected Contact dialog's fields hold. */
interface ConnectionDialogForm {
  connectedId: string | null;
  relationship: string;
  /** As typed. */
  order: string;
}

export interface ConnectionDialogState
  extends FormDialogState<ConnectionDialogForm> {
  /** The id of the connection the dialog edits; null for a new one. */
  editing: string | null;
}

/** What the Add Supplier dialog's fields hold. */
interface SupplierDialogForm {
  contactId: string | null;
}

export type SupplierDialogState = FormDialogState<SupplierDialogForm>;

/** What a read of a port holds now, and tells when it changes. */
interface Held<TValue> {
  get: () => TValue;
  changed$: Observable<TValue>;
  stop: () => void;
}

const BLANK_SUPPLIER: SupplierDialogForm = { contactId: null };

/** Each type's usual label: what a row of that type starts with. */
const USUAL_LABELS: Record<ContactRowType, string> = {
  phone: "Phone",
  email: "Email",
  web: "Website",
  im: "Instant messaging",
  pec: "Certified email",
};

/**
 * The New and Edit Person and Company dialog. The fields, the addresses and
 * the rows are held in the form, and nothing is written until `save`, which
 * writes the whole draft in one call and, for a new contact, hands the id the
 * port gave it to `onAdded` before it answers. Last name (a person) or
 * company name is required; a code another contact has is refused. The
 * contacts and the salutations are read as the port gives them, and the form
 * is judged again when the contacts change. A new contact starts Active on
 * the first salutation (those that arrive later do not change it).
 */
export function createContactDialog(
  port: ContactsPort,
  context: ContactDialogContext,
  spec: ContactDialogSpec,
  onAdded: (id: string) => void,
): Machine<ContactDialogState, ContactDialogIntents> {
  const { editing } = spec;
  const kind = editing?.kind ?? spec.kind;
  const editingId = editing?.id ?? null;
  const contacts = hold(port.contacts(), []);
  const salutations = hold(port.salutations(), []);

  function judge(form: ContactDialogForm): Judgement<ContactDraft> {
    const draft = draftOf(kind, form, context.year);

    return {
      verdict: validateContact(draft, contacts.get(), editingId),
      draft,
      filled:
        draft.kind === "person"
          ? draft.lastName !== ""
          : draft.companyName !== "",
    };
  }

  const machine = createFormDialog({
    initial:
      editing === null
        ? blankContactForm(salutations.get()[0] ?? null)
        : contactFormOf(editing),
    fixed: [],
    judge,
    stateOf: (base: FormDialogState<ContactDialogForm>): ContactDialogState => {
      return {
        ...base,
        kind,
        editing: editingId,
        salutations: salutations.get(),
        nextOrder: nextOrderOf(base.form.rows),
      };
    },
    write: async (draft: ContactDraft): Promise<Result> => {
      if (editingId !== null) {
        return port.editContact(editingId, draft);
      }

      const added = await port.addContact(draft);

      if (!added.ok) {
        return added;
      }

      onAdded(added.value.id);

      return ok();
    },
    rejudge$: contacts.changed$,
  });

  function setRows(rows: ContactRowDraft[]): void {
    machine.intents.edit({ rows });
  }

  function rowsNow(): ContactRowDraft[] {
    return machine.state$.getValue().form.rows;
  }

  return withCleanup(
    {
      ...machine,
      intents: {
        ...machine.intents,
        removeRow: (index: number): void => {
          setRows(
            rowsNow().filter((_row, at) => {
              return at !== index;
            }),
          );
        },
        applyRow: (index: number | null, row: ContactRowDraft): void => {
          const rows = rowsNow();

          setRows(
            index === null
              ? [...rows, row]
              : rows.map((held, at) => {
                  return at === index ? row : held;
                }),
          );
        },
      },
    },
    [contacts, salutations],
  );
}

/**
 * The Add and Edit Contact dialog on one row of a contact's form. It writes no
 * port: `apply` hands the row to the contact dialog's form. A new row starts
 * on `nextOrder` and Phone; changing the type changes a label that is still
 * the previous type's usual one.
 */
export function createContactRowDialog(
  row: ContactRowDraft | null,
  nextOrder: number,
  apply: (row: ContactRowDraft) => void,
): Machine<ContactRowDialogState, DialogIntents<ContactRowDialogForm>> {
  function judge(form: ContactRowDialogForm): Judgement<ContactRowDraft> {
    const draft: ContactRowDraft = {
      id: row?.id ?? null,
      type: form.type,
      label: form.label.trim(),
      value: form.value.trim(),
      order: Number(form.order),
    };

    return {
      verdict: validateContactRow(draft),
      draft,
      filled:
        draft.label !== "" && draft.value !== "" && form.order.trim() !== "",
    };
  }

  const machine = createFormDialog({
    initial:
      row === null
        ? {
            order: String(nextOrder),
            type: "phone",
            label: USUAL_LABELS.phone,
            value: "",
          }
        : {
            order: String(row.order),
            type: row.type,
            label: row.label,
            value: row.value,
          },
    fixed: [],
    judge,
    stateOf: (base: ContactRowDialogState): ContactRowDialogState => {
      return base;
    },
    write: (draft: ContactRowDraft): Promise<Result> => {
      apply(draft);

      return Promise.resolve(ok());
    },
    rejudge$: NEVER,
  });

  return {
    ...machine,
    intents: {
      ...machine.intents,
      edit: (patch: Partial<ContactRowDialogForm>): void => {
        const { type, label } = machine.state$.getValue().form;
        const follows =
          patch.type !== undefined &&
          patch.label === undefined &&
          label === USUAL_LABELS[type];

        machine.intents.edit(
          follows && patch.type !== undefined
            ? { ...patch, label: USUAL_LABELS[patch.type] }
            : patch,
        );
      },
    },
  };
}

/**
 * The New and Edit Category dialog: a name no other category has, trimmed.
 * For a new category, `onAdded` gets the id the port gave it before the save
 * answers.
 */
export function createCategoryDialog(
  port: ContactsPort,
  editing: ContactCategory | null,
  onAdded: (id: string) => void,
): Machine<CategoryDialogState, DialogIntents<CategoryDialogForm>> {
  const editingId = editing?.id ?? null;
  const categories = hold<ContactCategory[]>(port.categories(), []);

  function judge(form: CategoryDialogForm): Judgement<string> {
    const name = form.name.trim();

    return {
      verdict: validateCategory(name, categories.get(), editingId),
      draft: name,
      filled: name !== "",
    };
  }

  const machine = createFormDialog({
    initial: { name: editing?.name ?? "" },
    fixed: [],
    judge,
    stateOf: (
      base: FormDialogState<CategoryDialogForm>,
    ): CategoryDialogState => {
      return { ...base, editing: editingId };
    },
    write: async (name: string): Promise<Result> => {
      if (editingId !== null) {
        return port.editCategory(editingId, name);
      }

      const added = await port.addCategory(name);

      if (!added.ok) {
        return added;
      }

      onAdded(added.value.id);

      return ok();
    },
    rejudge$: categories.changed$,
  });

  return withCleanup(machine, [categories]);
}

/**
 * The Add and Edit Connected Contact dialog on one contact: the contact it is
 * connected to, what it is to this one, and the order. A new connection
 * starts on the next free order of this contact's.
 */
export function createConnectionDialog(
  port: ContactsPort,
  contactId: string,
  editing: ContactConnection | null,
): Machine<ConnectionDialogState, DialogIntents<ConnectionDialogForm>> {
  const editingId = editing?.id ?? null;
  const connections = hold<ContactConnection[]>(
    port.connections(contactId),
    [],
  );

  function judge(form: ConnectionDialogForm): Judgement<ConnectionDraft> {
    const draft: ConnectionDraft = {
      connectedId: form.connectedId,
      relationship: form.relationship.trim(),
      order: Number(form.order),
    };

    return {
      verdict: validateConnection(
        contactId,
        draft,
        connections.get(),
        editingId,
      ),
      draft,
      filled:
        draft.connectedId !== null &&
        draft.relationship !== "" &&
        form.order.trim() !== "",
    };
  }

  const machine = createFormDialog({
    initial:
      editing === null
        ? {
            connectedId: null,
            relationship: "",
            order: String(
              Math.max(
                0,
                ...connections.get().map((connection) => {
                  return connection.order;
                }),
              ) + 1,
            ),
          }
        : {
            connectedId: editing.connectedId,
            relationship: editing.relationship,
            order: String(editing.order),
          },
    fixed: [],
    judge,
    stateOf: (
      base: FormDialogState<ConnectionDialogForm>,
    ): ConnectionDialogState => {
      return { ...base, editing: editingId };
    },
    write: async (draft: ConnectionDraft): Promise<Result> => {
      const answer =
        editingId === null
          ? await port.addConnection(contactId, draft)
          : await port.editConnection(editingId, draft);

      return answer.ok ? ok() : answer;
    },
    rejudge$: connections.changed$,
  });

  return withCleanup(machine, [connections]);
}

/** The Add Supplier dialog on one building: the contact to add, refused while it is none or already a supplier. */
export function createSupplierDialog(
  contactsPort: ContactsPort,
  buildingsPort: BuildingsPort,
  buildingId: string,
): Machine<SupplierDialogState, DialogIntents<SupplierDialogForm>> {
  const contacts = hold<Contact[]>(contactsPort.contacts(), []);
  const suppliers = hold<string[]>(buildingsPort.suppliers(buildingId), []);

  function judge(form: SupplierDialogForm): Judgement<string | null> {
    const links: SupplierLink[] = suppliers.get().map((contactId) => {
      return { buildingId, contactId };
    });

    const held = contacts.get().find((contact) => {
      return contact.id === form.contactId;
    });

    return {
      verdict: validateSupplier(
        buildingId,
        form.contactId,
        links,
        held === undefined ? "" : nameOf(held),
      ),
      draft: form.contactId,
      filled: form.contactId !== null,
    };
  }

  const machine = createFormDialog({
    initial: BLANK_SUPPLIER,
    fixed: [],
    judge,
    stateOf: (base: SupplierDialogState): SupplierDialogState => {
      return base;
    },
    write: (contactId: string | null): Promise<Result> => {
      return buildingsPort.addSupplier(buildingId, contactId);
    },
    rejudge$: merge(contacts.changed$, suppliers.changed$),
  });

  return withCleanup(machine, [contacts, suppliers]);
}

/** The draft the fields make: blank text as none, the birth date as ISO when it reads, as typed when it does not, so the validator refuses it. */
function draftOf(
  kind: ContactDialogState["kind"],
  form: ContactDialogForm,
  year: number,
): ContactDraft {
  const common = {
    status: form.status,
    code: textOrNull(form.code),
    categoryId: form.categoryId,
    salutation: form.salutation,
    taxCode: textOrNull(form.taxCode),
    vatNumber: textOrNull(form.vatNumber),
    postalAddress: form.postalAddress,
    language: form.language,
    notes: textOrNull(form.notes),
    rows: form.rows,
  };

  if (kind === "company") {
    return {
      ...common,
      kind,
      companyName: form.companyName.trim(),
      registeredOffice: form.registeredOffice,
      taxDomicile: form.taxDomicile,
    };
  }

  return {
    ...common,
    kind,
    firstName: textOrNull(form.firstName),
    lastName: form.lastName.trim(),
    gender: form.gender,
    birthDate: birthDateOf(form.birthDate, year),
    birthPlace: textOrNull(form.birthPlace),
    officeAddress: form.officeAddress,
    residenceAddress: form.residenceAddress,
    domicileAddress: form.domicileAddress,
  };
}

/** The typed date as ISO; null while blank; as typed when it does not read, which the validator refuses. */
function birthDateOf(text: string, year: number): string | null {
  const date = dateOf(text, year);

  return date === undefined ? text.trim() : date;
}

function blankContactForm(salutation: string | null): ContactDialogForm {
  return {
    status: "active",
    code: "",
    firstName: "",
    lastName: "",
    gender: null,
    birthDate: "",
    birthPlace: "",
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
    companyName: "",
    registeredOffice: null,
    taxDomicile: null,
    salutation,
    taxCode: "",
    vatNumber: "",
    categoryId: null,
    postalAddress: null,
    language: null,
    notes: "",
    rows: [],
  };
}

/** The form of a contact as it stands: what its kind lacks stays blank. */
function contactFormOf(contact: Contact): ContactDialogForm {
  const form: ContactDialogForm = {
    ...blankContactForm(contact.salutation),
    status: contact.status,
    code: contact.code ?? "",
    taxCode: contact.taxCode ?? "",
    vatNumber: contact.vatNumber ?? "",
    categoryId: contact.categoryId,
    postalAddress: contact.postalAddress,
    language: contact.language,
    notes: contact.notes ?? "",
    rows: contact.rows,
  };

  if (contact.kind === "company") {
    return {
      ...form,
      companyName: contact.companyName,
      registeredOffice: contact.registeredOffice,
      taxDomicile: contact.taxDomicile,
    };
  }

  return {
    ...form,
    firstName: contact.firstName ?? "",
    lastName: contact.lastName,
    gender: contact.gender,
    birthDate: dateText(contact.birthDate),
    birthPlace: contact.birthPlace ?? "",
    officeAddress: contact.officeAddress,
    residenceAddress: contact.residenceAddress,
    domicileAddress: contact.domicileAddress,
  };
}

/** The highest order held plus one; 1 for no rows. */
function nextOrderOf(rows: ContactRowDraft[]): number {
  return (
    Math.max(
      0,
      ...rows.map((row) => {
        return row.order;
      }),
    ) + 1
  );
}

/** A read of a port kept as it last answered, from `initial` until the first answer. */
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

/** The machine, whose disposal also stops the reads it held. */
function withCleanup<TMachine extends Machine<unknown, object>>(
  machine: TMachine,
  held: Held<unknown>[],
): TMachine {
  return {
    ...machine,
    dispose: (): void => {
      machine.dispose();

      for (const read of held) {
        read.stop();
      }
    },
  };
}
