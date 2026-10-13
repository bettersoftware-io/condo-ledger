import { describe, expect, it } from "vitest";

import { mountToastHost } from "./ToastHost.page.tsx";

describe("ToastHost", () => {
  it("shows nothing until something is posted", () => {
    const page = mountToastHost();

    expect(page.toasts()).toEqual([]);
  });

  it("shows a notice the app posts", async () => {
    const page = mountToastHost();

    await page.stub("Print balances");

    expect(page.toasts()).toEqual(["Print balances: not yet available"]);
  });

  it("dismissing a notice clears that one only", async () => {
    const page = mountToastHost();

    await page.stub("Print balances");
    await page.stub("Log out");
    await page.dismiss(0);

    expect(page.toasts()).toEqual(["Log out: not yet available"]);
  });
});
