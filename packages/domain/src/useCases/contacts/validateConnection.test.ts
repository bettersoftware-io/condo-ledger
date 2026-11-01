import { describe, expect, it } from "vitest";

import type { ContactConnection } from "#/entities/contact.ts";

import {
  type ConnectionDraft,
  validateConnection,
} from "./validateConnection.ts";

describe("validateConnection", () => {
  it("accepts a connection", () => {
    expect(
      validateConnection(
        "md1",
        createDraft({ connectedId: "md3" }),
        connections,
        null,
      ),
    ).toEqual({ ok: true });
  });

  it("refuses no contact and the contact itself", () => {
    expect(
      validateConnection("md1", createDraft({ connectedId: null }), [], null),
    ).toEqual({ ok: false, reason: "no-contact" });
    expect(
      validateConnection("md1", createDraft({ connectedId: "md1" }), [], null),
    ).toEqual({ ok: false, reason: "same-contact" });
  });

  it("refuses a blank relationship", () => {
    expect(
      validateConnection("md1", createDraft({ relationship: " " }), [], null),
    ).toEqual({ ok: false, reason: "blank-relationship" });
  });

  it("allows 127 characters and refuses 128", () => {
    expect(
      validateConnection(
        "md1",
        createDraft({ relationship: "a".repeat(127) }),
        [],
        null,
      ),
    ).toEqual({ ok: true });
    expect(
      validateConnection(
        "md1",
        createDraft({ relationship: "a".repeat(128) }),
        [],
        null,
      ),
    ).toEqual({ ok: false, reason: "relationship-too-long" });
  });

  it("refuses the same contact with the same relationship, by case", () => {
    expect(
      validateConnection(
        "md1",
        createDraft({ connectedId: "md2", relationship: "MANAGING director " }),
        connections,
        null,
      ),
    ).toEqual({ ok: false, reason: "connection-taken", detail: "md2" });
  });

  it("allows another relationship, another owner of the row, and the row itself", () => {
    expect(
      validateConnection(
        "md1",
        createDraft({ connectedId: "md2", relationship: "Accountant" }),
        connections,
        null,
      ),
    ).toEqual({ ok: true });
    expect(
      validateConnection(
        "md3",
        createDraft({ connectedId: "md2", relationship: "Managing director" }),
        connections,
        null,
      ),
    ).toEqual({ ok: true });
    expect(
      validateConnection(
        "md1",
        createDraft({ connectedId: "md2", relationship: "Managing director" }),
        connections,
        "cr1",
      ),
    ).toEqual({ ok: true });
  });
});

function createDraft(over: Partial<ConnectionDraft>): ConnectionDraft {
  return {
    connectedId: "md2",
    relationship: "Managing director",
    order: 1,
    ...over,
  };
}

const connections: ContactConnection[] = [
  {
    id: "cr1",
    contactId: "md1",
    connectedId: "md2",
    relationship: "Managing director",
    order: 1,
  },
];
