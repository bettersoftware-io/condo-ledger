import { describe, expect, it } from "vitest";

import { encodeReady, parseServerMessage } from "./protocol.ts";

describe("the wire protocol", () => {
  it("encodes the greeting the server sends on connect", () => {
    expect(encodeReady()).toEqual({ type: "ready" });
  });

  it("parses the greeting back", () => {
    expect(parseServerMessage({ type: "ready" })).toEqual({ type: "ready" });
  });

  it("answers undefined for anything it does not know", () => {
    expect(parseServerMessage(null)).toBeUndefined();
    expect(parseServerMessage("ready")).toBeUndefined();
    expect(parseServerMessage({ type: "price", payload: {} })).toBeUndefined();
  });
});
