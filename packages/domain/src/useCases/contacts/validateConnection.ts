import type { ContactConnection } from "#/entities/contact.ts";
import { ok, type Result, rejected } from "#/entities/result.ts";

/** What the connection dialog hands the port. */
export interface ConnectionDraft {
  connectedId: string | null;
  relationship: string;
  order: number;
}

const RELATIONSHIP_MAX = 127;

/**
 * Whether a connection shown on `contactId` may be saved: `editing` is its
 * id, null for a new one. The reasons are checked in this order: no contact,
 * the contact itself, a blank relationship, one over 127 characters, and the
 * same contact with the same relationship already on `contactId` (the
 * detail is the connected contact's id). Relationships compare trimmed and
 * by case.
 */
export function validateConnection(
  contactId: string,
  draft: ConnectionDraft,
  connections: ContactConnection[],
  editing: string | null,
): Result {
  const { connectedId } = draft;

  if (connectedId === null) {
    return rejected("no-contact");
  }

  if (connectedId === contactId) {
    return rejected("same-contact");
  }

  const relationship = draft.relationship.trim();

  if (relationship === "") {
    return rejected("blank-relationship");
  }

  if (relationship.length > RELATIONSHIP_MAX) {
    return rejected("relationship-too-long");
  }

  const taken = connections.some((connection) => {
    return (
      connection.id !== editing &&
      connection.contactId === contactId &&
      connection.connectedId === connectedId &&
      connection.relationship.trim().toLowerCase() ===
        relationship.toLowerCase()
    );
  });

  return taken ? rejected("connection-taken", connectedId) : ok();
}
