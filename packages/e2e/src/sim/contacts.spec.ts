import { expect, test } from "#/testing/test.ts";

test.describe("the contacts, on the simulator", () => {
  test("a contact renamed in Contacts has its new name on Units", async ({
    shell,
    contacts,
    units,
  }) => {
    // The app opens on Saturno 2011, where B3 has one owner.
    await shell.open();
    await shell.openModule("Contacts");

    await contacts.search("Ornella");
    await expect.poll(contacts.names).toEqual(["Tavano Ornella"]);
    await expect.poll(contacts.selectedName).toBe("Tavano Ornella");

    await contacts.renameSelected("Tavanello");

    // The renamed row keeps its selection, where its new name puts it.
    await expect.poll(contacts.names).toEqual(["Tavanello Ornella"]);
    await expect.poll(contacts.selectedName).toBe("Tavanello Ornella");

    await shell.openModule("Buildings");
    await shell.openScreen("Units, Owners & Personal Balance");
    await expect.poll(units.rowLabels).toContain("B3 - Tavanello Ornella (PR)");
  });

  test("a person made from Add Owner is the unit's owner", async ({
    shell,
    units,
  }) => {
    await shell.open();
    await shell.openScreen("Units, Owners & Personal Balance");
    await units.selectUnit("B3");

    await units.addOwnerAsNewPerson("Ines", "Zanardi");

    await expect
      .poll(units.rowLabels)
      .toContain("B3 - Tavano Ornella, Zanardi Ines");
  });
});
