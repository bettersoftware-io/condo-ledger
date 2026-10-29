import { describe, expect, it } from "vitest";

import { mountTableDialog } from "./TableDialog.page.tsx";

describe("TableDialog", () => {
  it("a new table opens blank on the order after p1's five, and Add waits for a name", async () => {
    const { dialog, saved } = mountTableDialog(null);

    expect(dialog.title()).toBe("New Thousandth Table");
    expect(dialog.requiredUnannounced()).toEqual([]);
    expect(dialog.fieldValue("Name")).toBe("");
    expect(dialog.fieldValue("Order")).toBe("6");
    expect(dialog.fieldValue("Notes")).toBe("");
    expect(dialog.saveLabel()).toBe("+ Add");
    expect(dialog.isSaveDisabled()).toBe(true);
    expect(dialog.message()).toBeNull();

    await dialog.fill("Name", "Test");
    await dialog.fill("Notes", "For the new lift");

    expect(dialog.isSaveDisabled()).toBe(false);

    await dialog.save();

    expect(saved()).toEqual(["dt-new-1"]);
  });

  it("refuses a name another table has, a blank name and an order that is not a whole number from 1", async () => {
    const { dialog } = mountTableDialog(null);

    await dialog.fill("Name", "Stairs");

    expect(dialog.message()).toBe("A table named Stairs already exists");
    expect(dialog.isSaveDisabled()).toBe(true);

    await dialog.fill("Name", "");

    expect(dialog.message()).toBe("A table needs a name");

    await dialog.fill("Name", "Test");
    await dialog.fill("Order", "0");

    expect(dialog.message()).toBe("Enter the order as a whole number from 1");
    expect(dialog.isSaveDisabled()).toBe(true);
  });

  it("edits a table as it stands: Stairs, order 3, saved under its own id", async () => {
    const { dialog, saved } = mountTableDialog("dt3");

    expect(dialog.title()).toBe("Edit Thousandth Table");
    expect(dialog.fieldValue("Name")).toBe("Stairs");
    expect(dialog.fieldValue("Order")).toBe("3");
    expect(dialog.saveLabel()).toBe("✎ Save");
    expect(dialog.isSaveDisabled()).toBe(false);

    await dialog.fill("Order", "1");
    await dialog.pressEnter();

    expect(saved()).toEqual(["dt3"]);
  });

  it("Enter does nothing while Save cannot go on, and Cancel closes", async () => {
    const { dialog, saved, cancels } = mountTableDialog(null);

    await dialog.fill("Name", "Stairs");
    await dialog.pressEnter();

    expect(saved()).toEqual([]);

    await dialog.cancel();

    expect(cancels()).toBe(1);
  });

  it("shows the store's refusal of a name taken while it was open, until the next edit", async () => {
    const { dialog, saved, addTableElsewhere } = mountTableDialog(null);

    await addTableElsewhere("Test");
    await dialog.fill("Name", "Test");

    expect(dialog.message()).toBeNull();

    await dialog.save();

    expect(saved()).toEqual([]);
    expect(dialog.message()).toBe("A table named Test already exists");

    await dialog.fill("Name", "Test 2");

    expect(dialog.message()).toBeNull();
  });
});
