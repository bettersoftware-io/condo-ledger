import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { condominium, unitGroup } from "../src/schema/condominium.ts";
import { studio, masterData, person, accessAccount, masterDataTaxTreatment } from "../src/schema/masterData.ts";
import { country, city, bank, bankBranch } from "../src/schema/reference.ts";
import { ledgerAccount, ledgerTransaction } from "../src/schema/accounting.ts";
import { expenseLA2Table } from "../src/schema/accounting.ts";
import { installmentItem } from "../src/schema/installment.ts";

describe("schema shape — condominium area", () => {
  it("condominium: snake_case name, identity PK, self-ref parent_condominium_id, studio_id, type enum, created/updated", () => {
    const t = getTableConfig(condominium);
    expect(t.name).toBe("condominium");
    expect(t.columns.find((c) => c.name === "id")!.primary).toBe(true);
    const names = t.columns.map((c) => c.name);
    expect(names).toContain("parent_condominium_id");
    expect(names).toContain("studio_id");
    expect(names).toContain("created");
    expect(names).toContain("updated");
    expect(names).not.toContain("last_modified");
    expect(t.columns.find((c) => c.name === "type")!.enumValues).toEqual(["regular", "super", "residence"]);
  });
  it("unitGroup self-references via parent_unit_group_id", () => {
    expect(getTableConfig(unitGroup).columns.map((c) => c.name)).toContain("parent_unit_group_id");
  });
});

describe("schema shape — masterData area", () => {
  it("studio has identity PK", () => {
    expect(getTableConfig(studio).columns.find((c) => c.name === "id")!.primary).toBe(true);
  });
  it("masterData has audit self-FKs, not a hierarchy parent", () => {
    const names = getTableConfig(masterData).columns.map((c) => c.name);
    expect(names).toContain("created_master_data_id");
    expect(names).toContain("last_modified_master_data_id");
    expect(names).not.toContain("parent_id");
  });
  it("person.sex is the person_sex enum", () => {
    expect(getTableConfig(person).columns.find((c) => c.name === "sex")!.enumValues).toEqual(["m", "f"]);
  });
  it("accessAccount.role uses access_account_role enum", () => {
    expect(getTableConfig(accessAccount).columns.find((c) => c.name === "role")!.enumValues).toContain("administrator");
  });
  it("masterDataTaxTreatment renames reserved 'default' to is_default boolean", () => {
    const names = getTableConfig(masterDataTaxTreatment).columns.map((c) => c.name);
    expect(names).toContain("is_default");
    expect(names).not.toContain("default");
  });
});

describe("schema shape — reference area", () => {
  it("country has natural char PK; city has identity PK", () => {
    // country's legacy PK is the ISO alpha-2 code, not a synthetic id (faithful to DDL).
    expect(getTableConfig(country).columns.find((c) => c.name === "iso3166_1_alpha2")!.primary).toBe(true);
    expect(getTableConfig(city).columns.find((c) => c.name === "id")!.primary).toBe(true);
  });
  it("bankBranch references bank", () => {
    expect(getTableConfig(bankBranch).foreignKeys.length).toBeGreaterThanOrEqual(1);
  });
});

describe("schema shape — operational areas", () => {
  it("ledgerAccount self-refs via parent_ledger_account_id and has type+kind enums", () => {
    const t = getTableConfig(ledgerAccount);
    const names = t.columns.map((c) => c.name);
    expect(names).toContain("parent_ledger_account_id");
    expect(t.columns.find((c) => c.name === "type")!.enumValues).toContain("controlUnitResident");
    expect(t.columns.find((c) => c.name === "kind")!.enumValues).toContain("assetsOrLiabilities");
  });
  it("ledgerTransaction keeps the extra timestamp column", () => {
    expect(getTableConfig(ledgerTransaction).columns.map((c) => c.name)).toContain("timestamp");
  });
  it("installmentItem.status is the 4-value enum", () => {
    expect(getTableConfig(installmentItem).columns.find((c) => c.name === "status")!.enumValues)
      .toEqual(["issued", "incomplete", "settled", "neutralized"]);
  });
  it("expenseLA2Table.type is estimate/currentBalance", () => {
    expect(getTableConfig(expenseLA2Table).columns.find((c) => c.name === "type")!.enumValues)
      .toEqual(["estimate", "currentBalance"]);
  });
});
