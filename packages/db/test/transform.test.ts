import { describe, it, expect } from "vitest";
import { makeTransform } from "../etl/transform.ts";
import type { DdlColumn } from "../etl/ddl.ts";

describe("makeTransform — column renames", () => {
  it("snake_cases normal columns", () => {
    const r = transformRow("condominium", ["id", "name"], ["1", "Saturno"]);
    expect(r).toEqual({ id: "1", name: "Saturno" });
  });

  it("renames `default` to is_default", () => {
    const r = transformRow("masterDataTaxTreatment", ["id", "default"], ["1", "1"]);
    expect(r).toHaveProperty("is_default");
    expect(r).not.toHaveProperty("default");
  });

  it("renames `lastModified` to updated", () => {
    const r = transformRow(
      "condominium",
      ["id", "lastModified"],
      ["1", "2011-01-01 00:00:00"],
    );
    expect(r).toHaveProperty("updated");
    expect(r).not.toHaveProperty("last_modified");
  });

  it("does NOT rename audit-FK columns to updated (exact-match only)", () => {
    const r = transformRow(
      "masterData",
      ["id", "createdMasterDataId", "lastModifiedMasterDataId"],
      ["1", "2", "3"],
    );
    expect(r).toEqual({
      id: "1",
      created_master_data_id: "2",
      last_modified_master_data_id: "3",
    });
    expect(r).not.toHaveProperty("updated");
  });
});

describe("makeTransform — type classification", () => {
  it("tinyint(1): '1' -> true, '0' -> false (isActive)", () => {
    expect(transformRow("condominium", ["isActive"], ["1"]).is_active).toBe(true);
    expect(transformRow("condominium", ["isActive"], ["0"]).is_active).toBe(false);
  });

  it("tinyint(1): bool also applies to renamed `default`", () => {
    expect(transformRow("masterDataTaxTreatment", ["default"], ["1"]).is_default).toBe(true);
    expect(transformRow("masterDataTaxTreatment", ["default"], ["0"]).is_default).toBe(false);
  });

  it("datetime: Rome->UTC (CET +01:00 in winter)", () => {
    const r = transformRow("condominium", ["id", "created"], ["1", "2011-01-01 00:00:00"]);
    expect(r.created).toBe("2010-12-31T23:00:00.000Z");
  });

  it("datetime: Rome->UTC (CEST +02:00 in summer)", () => {
    const r = transformRow("condominium", ["id", "created"], ["1", "2011-07-01 00:00:00"]);
    expect(r.created).toBe("2011-06-30T22:00:00.000Z");
  });

  it("date: passes through verbatim (NO tz shift)", () => {
    const r = transformRow("condominium", ["id", "birthDate"], ["1", "1980-05-20"]);
    expect(r.birth_date).toBe("1980-05-20");
  });

  it("raw: passes through (string)", () => {
    const r = transformRow("condominium", ["id", "name"], ["42", "x"]);
    expect(r.id).toBe("42");
    expect(r.name).toBe("x");
  });
});

describe("makeTransform — nulls and unknown columns", () => {
  it("NULL passes through as null", () => {
    const r = transformRow("condominium", ["id", "created"], ["1", null]);
    expect(r.created).toBeNull();
  });

  it("unknown column (not in ddl) passes through raw without crashing", () => {
    const r = transformRow("condominium", ["mysteryCol"], ["abc"]);
    expect(r.mystery_col).toBe("abc");
  });
});

// Small inline DDL — kept a pure unit (no real file read here).
const ddl: Record<string, DdlColumn[]> = {
  condominium: [
    { name: "id", sqlType: "int" },
    { name: "name", sqlType: "varchar(255)" },
    { name: "isActive", sqlType: "tinyint(1)" },
    { name: "created", sqlType: "datetime" },
    { name: "lastModified", sqlType: "datetime" },
    { name: "birthDate", sqlType: "date" },
  ],
  masterDataTaxTreatment: [
    { name: "id", sqlType: "int" },
    { name: "default", sqlType: "tinyint(1)" },
  ],
  masterData: [
    { name: "id", sqlType: "int" },
    { name: "createdMasterDataId", sqlType: "int" },
    { name: "lastModifiedMasterDataId", sqlType: "int" },
  ],
};

const transformRow = makeTransform(ddl);
