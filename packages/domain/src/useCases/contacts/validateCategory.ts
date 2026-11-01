import type { Contact, ContactCategory } from "#/entities/contact.ts";
import { ok, type Result, rejected } from "#/entities/result.ts";

const NAME_MAX = 63;

/**
 * Whether a category may be saved with this name: `editing` is its id, null
 * for a new one. The reasons are checked in this order: a blank name, a name
 * over 63 characters, a name another category has. Names compare trimmed and
 * by case.
 */
export function validateCategory(
  name: string,
  categories: ContactCategory[],
  editing: string | null,
): Result {
  const trimmed = name.trim();

  if (trimmed === "") {
    return rejected("blank-name");
  }

  if (trimmed.length > NAME_MAX) {
    return rejected("name-too-long");
  }

  const taken = categories.some((category) => {
    return (
      category.id !== editing &&
      category.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
  });

  return taken ? rejected("category-name-taken", trimmed) : ok();
}

/** Whether a category may be deleted: not while a contact is in it; the detail is how many are. */
export function validateCategoryDelete(
  category: ContactCategory,
  contacts: Contact[],
): Result {
  const count = contacts.filter((contact) => {
    return contact.categoryId === category.id;
  }).length;

  return count === 0 ? ok() : rejected("category-not-empty", String(count));
}
