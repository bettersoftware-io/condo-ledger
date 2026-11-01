import { describe, expect, it } from "vitest";

import { mountTextCell } from "./TextCell.page.tsx";

describe("TextCell", () => {
  it("shows its value, and the whole of it as a tooltip for when it is cut", () => {
    const page = mountTextCell({ value: "Via Garibaldi 12, 20121 Milano" });

    expect(page.text()).toBe("Via Garibaldi 12, 20121 Milano");
    expect(page.tooltip()).toBe("Via Garibaldi 12, 20121 Milano");
  });

  it.each([null, ""])("shows --- and no tooltip for %j", (value) => {
    const page = mountTextCell({ value });

    expect(page.text()).toBe("---");
    expect(page.tooltip()).toBeNull();
  });
});
