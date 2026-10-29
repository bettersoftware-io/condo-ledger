import { describe, expect, it } from "vitest";

import {
  type InstallmentScheduleScreenPage,
  mountInstallmentSchedule,
} from "./InstallmentScheduleScreen.page.tsx";

describe("InstallmentDialog", () => {
  it('on p36, Edit "Installment 3" renames it and moves its due date: the menu and the header show them', async () => {
    const page = mountInstallmentSchedule("p36");
    const dialog = await openEdit(page, "Installment 3");

    expect(dialog.title()).toBe("Edit Installment");
    expect(dialog.requiredUnannounced()).toEqual([]);
    expect(dialog.fieldValue("Name")).toBe("Installment 3");
    expect(dialog.fieldValue("Due date")).toBe("20/03/2013");
    expect(dialog.isLocked()).toBe(false);

    await dialog.fill("Name", "Rata tre");
    await dialog.fill("Due date", "25/03/2013");
    await dialog.save();

    expect(dialog.isShown()).toBe(false);
    expect(page.grid.headers()).toContain("3 25/03/2013");
    expect(page.grid.headers()).not.toContain("3 20/03/2013");

    await page.toolbar.clickTool("Edit installments");

    expect(page.toolbar.menuItems()[2]).toBe('Edit "Rata tre"');
  });

  it("refuses a name another installment has, a blank name and a day that is not one, and Save waits", async () => {
    const page = mountInstallmentSchedule("p36");
    const dialog = await openEdit(page, "Installment 3");

    expect(dialog.message()).toBeNull();

    await dialog.fill("Name", "Installment 4");

    expect(dialog.message()).toBe(
      "Another installment of this period already has this name.",
    );
    expect(dialog.isSaveDisabled()).toBe(true);

    await dialog.fill("Name", "");

    expect(dialog.message()).toBe("An installment needs a name.");

    await dialog.fill("Name", "Installment 3");
    await dialog.fill("Due date", "31/02/2013");

    expect(dialog.message()).toBe("Enter a due date as day/month/year.");
    expect(dialog.isSaveDisabled()).toBe(true);
  });

  it("while Locked is on, Name and Due date are disabled; unticked, a rename saves with the unlock in one", async () => {
    const page = mountInstallmentSchedule("p1");
    const dialog = await openEdit(page, "Installment 1");

    expect(dialog.isLocked()).toBe(true);
    expect(dialog.isEnabled("Name")).toBe(false);
    expect(dialog.isEnabled("Due date")).toBe(false);

    await dialog.toggleLocked();

    expect(dialog.isEnabled("Name")).toBe(true);
    expect(dialog.isEnabled("Due date")).toBe(true);

    await dialog.fill("Name", "Prima rata");
    await dialog.save();

    expect(dialog.isShown()).toBe(false);
    expect(page.grid.headers()[7]).toBe("1 15/03/2011");

    await page.toolbar.clickTool("Edit installments");

    expect(page.toolbar.menuItems()[0]).toBe('Edit "Prima rata"');
  });

  it("Enter in a field saves as Save does, and does nothing while the form is refused", async () => {
    const page = mountInstallmentSchedule("p36");
    const dialog = await openEdit(page, "Installment 3");

    await dialog.fill("Name", "Installment 4");
    await dialog.pressEnter();

    expect(dialog.isShown()).toBe(true);

    await dialog.fill("Name", "Rata tre");
    await dialog.pressEnter();

    expect(dialog.isShown()).toBe(false);

    await page.toolbar.clickTool("Edit installments");

    expect(page.toolbar.menuItems()[2]).toBe('Edit "Rata tre"');
  });

  it("a name another installment took meanwhile is refused by the store, said in the dialog, and an edit clears it", async () => {
    const page = mountInstallmentSchedule("p36");
    const dialog = await openEdit(page, "Installment 3");

    await dialog.fill("Name", "Rata tre");
    await page.renameElsewhere("Installment 4", "Rata tre");
    await dialog.save();

    expect(dialog.isShown()).toBe(true);
    expect(dialog.message()).toBe(
      "Another installment of this period already has this name.",
    );

    await dialog.fill("Name", "Rata terza");

    expect(dialog.message()).toBeNull();

    await dialog.save();

    expect(dialog.isShown()).toBe(false);
  });

  it("Cancel closes it and changes nothing", async () => {
    const page = mountInstallmentSchedule("p36");
    const dialog = await openEdit(page, "Installment 3");

    await dialog.fill("Due date", "25/03/2013");
    await dialog.cancel();

    expect(dialog.isShown()).toBe(false);
    expect(page.grid.headers()).toContain("3 20/03/2013");
  });
});

/** Opens the dialog from the Edit installments menu. */
async function openEdit(
  page: InstallmentScheduleScreenPage,
  name: string,
): Promise<InstallmentScheduleScreenPage["installmentDialog"]> {
  await page.toolbar.clickTool("Edit installments");
  await page.toolbar.clickMenuItem(`Edit "${name}"`);

  return page.installmentDialog;
}
