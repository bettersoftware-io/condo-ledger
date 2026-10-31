import { expect, test } from "#/testing/test.ts";

test.describe("adding an owner, on the simulator", () => {
  test("shows the new owner in the Units grid and in the Installment Schedule", async ({
    shell,
    units,
    schedule,
  }) => {
    // The app opens on Saturno 2011, where B3 has one owner.
    await shell.open();
    await shell.openScreen("Units, Owners & Personal Balance");
    await expect.poll(units.rowLabels).toContain("B3 - Tavano Ornella (PR)");

    await units.selectUnit("B3");
    await units.addOwner("Forgiarini", "Forgiarini Lino");

    await expect
      .poll(units.rowLabels)
      .toContain("B3 - Tavano Ornella, Forgiarini Lino");

    // A unit of two residents is a row over their own rows.
    await shell.openScreen("Installment Schedule");
    await expect
      .poll(scheduleOfB3(schedule.rowLabels))
      .toEqual(["B3", "Tavano Ornella", "Forgiarini Lino"]);
  });
});

/** B3's row and the two rows under it, as the schedule shows them. */
function scheduleOfB3(
  rowLabels: () => Promise<string[]>,
): () => Promise<string[]> {
  return async (): Promise<string[]> => {
    const labels = await rowLabels();
    const at = labels.indexOf("B3");

    return at === -1 ? [] : labels.slice(at, at + 3);
  };
}
