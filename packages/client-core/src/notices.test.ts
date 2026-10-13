import { describe, expect, it } from "vitest";

import { createNotices } from "./notices.ts";

describe("the notices", () => {
  it("posts a stub with its label, each with its own id", () => {
    const notices = createNotices();
    const subscription = notices.notices$.subscribe();

    notices.stub("Export");
    notices.stub("Print");

    expect(notices.notices$.getValue()).toEqual([
      { id: 1, text: "Export: not yet available" },
      { id: 2, text: "Print: not yet available" },
    ]);

    subscription.unsubscribe();
  });

  it("clears one notice and leaves the other", () => {
    const notices = createNotices();
    const subscription = notices.notices$.subscribe();

    notices.stub("Export");
    notices.stub("Print");
    notices.clear(1);

    expect(notices.notices$.getValue()).toEqual([
      { id: 2, text: "Print: not yet available" },
    ]);

    subscription.unsubscribe();
  });
});
