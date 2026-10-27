import { describe, expect, it } from "vitest";

import { type AccountRole, type LegacySeed, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { mountJournalScreen } from "../JournalScreen.page.tsx";
import { mountBudgetAllocationWizard } from "./BudgetAllocationWizard.page.tsx";

describe("BudgetAllocationWizard", () => {
  it("on p1, with tx5 deleted from the Journal, previews 11 debits and the credit of 7,400.00, and Save lists the entry", async () => {
    const page = mountJournalScreen({ legacyPeriod: "p1" });

    await page.clickRow(TX5);
    await page.clickTool("Delete entry");
    await page.confirmYes();

    expect(page.entryLabels()).not.toContain(TX5);

    const wizard = await page.openWizard("Budget allocation");
    const rows = wizard.previewRows();
    const debits = rows.filter((row) => {
      return row[2] !== "";
    });

    expect(wizard.title()).toBe("Budget Allocation — Accounting entry summary");
    expect(rows).toHaveLength(12);
    expect(debits).toHaveLength(11);
    expect(rows.at(-1)?.slice(2)).toEqual(["", "7,400.00"]);
    expect(wizard.message()).toBeNull();

    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.entryLabels()).toContain("Budget allocation (no.1)");
  });

  it("opens on the default description, with the design's helper text under it", async () => {
    const wizard = await mountBudgetAllocationWizard({
      periodId: "p1",
      deleting: ["tx5"],
    });

    expect(wizard.fieldValue("Description")).toBe("Budget allocation (no.1)");
    expect(wizard.helperText()).toBe(
      "Auto-generated from the approved budget — each owner is charged their share and the revenue account is credited.",
    );
    expect(wizard.isSaveDisabled()).toBe(false);

    await wizard.fill("Description", "Riparto 2011");
    await wizard.save();

    expect(wizard.saved()).toHaveLength(1);
  });

  it("on p1 as seeded, says at once that the period already has an allocation, and Save waits", async () => {
    const wizard = await mountBudgetAllocationWizard({ periodId: "p1" });

    expect(wizard.message()).toBe(
      "This period already has a budget allocation; delete it first",
    );
    expect(wizard.previewRows()).toEqual([]);
    expect(wizard.isSaveDisabled()).toBe(true);

    await wizard.cancel();

    expect(wizard.cancels()).toBe(1);
  });

  it("names, by its path, an account whose budget no table allocates", async () => {
    const wizard = await mountBudgetAllocationWizard({
      seed: createZeroTableSeed("dt1"),
      periodId: "p1",
      deleting: ["tx5"],
    });

    expect(wizard.message()).toBe(
      "Total › Costs › General expenses › Insurance has a budget but no table to allocate it",
    );
  });

  it("names the account a period lacks", async () => {
    const wizard = await mountBudgetAllocationWizard({
      seed: createSeedWithoutRole("budgetAllocation"),
      periodId: "p1",
      deleting: ["tx5"],
    });

    expect(wizard.message()).toBe(
      "This period has no budget allocation revenue account",
    );
  });

  it("asks for a description only once one is cleared", async () => {
    const wizard = await mountBudgetAllocationWizard({
      periodId: "p1",
      deleting: ["tx5"],
    });

    await wizard.fill("Description", "");

    expect(wizard.message()).toBe("A description is required");
    expect(wizard.isSaveDisabled()).toBe(true);
  });
});

/** tx5's description: Saturno 2011's budget allocation as the seed holds it. */
const TX5 = "Budget allocation (no. 1 of 14/03/2011)";

/** The real seed with every coefficient of the table at 0. */
function createZeroTableSeed(tableId: string): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    coefficients: seed.coefficients.map((coefficient) => {
      return coefficient.tableId === tableId
        ? { ...coefficient, value: 0 }
        : coefficient;
    }),
  };
}

/** The real seed with no account holding the role. */
function createSeedWithoutRole(role: AccountRole): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    accounts: seed.accounts.map((account) => {
      return account.role === role ? { ...account, role: null } : account;
    }),
  };
}
