import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import { mountMoney } from "./Money.page.tsx";

describe("Money", () => {
  it("is positive for money in", () => {
    const page = mountMoney({ cents: cents(123456) });

    expect(page.tone()).toBe("pos");
    expect(page.text()).toBe("1,234.56");
  });

  it("is negative for money out", () => {
    const page = mountMoney({ cents: cents(-60746) });

    expect(page.tone()).toBe("neg");
    expect(page.text()).toBe("-607.46");
  });

  it("is zero for nothing", () => {
    const page = mountMoney({ cents: cents(0) });

    expect(page.tone()).toBe("zero");
    expect(page.text()).toBe("0.00");
  });

  it("is blank and empty for null", () => {
    const page = mountMoney({ cents: null });

    expect(page.tone()).toBe("blank");
    expect(page.text()).toBe("");
  });

  it("is colored and not emphasised unless told otherwise", () => {
    const page = mountMoney({ cents: cents(100) });

    expect(page.variant()).toBe("colored");
    expect(page.emphasis()).toBe("false");
  });

  it("carries the plain variant and the emphasis", () => {
    const page = mountMoney({
      cents: cents(100),
      variant: "plain",
      emphasis: true,
    });

    expect(page.variant()).toBe("plain");
    expect(page.emphasis()).toBe("true");
  });
});
