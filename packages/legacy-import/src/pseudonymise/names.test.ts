import { describe, expect, it } from "vitest";

import {
  BANK_NAMES,
  COMPANY_PATTERNS,
  FEMALE_FIRST_NAMES,
  GENERIC_COMPANY_FORMS,
  LEGAL_FORMS,
  MALE_FIRST_NAMES,
  RIVERS,
  STREETS,
  SURNAMES,
  TOWNS,
} from "./names.ts";

describe("the name pools", () => {
  it("are large enough to give ~100 people distinct names", () => {
    expect(FEMALE_FIRST_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(MALE_FIRST_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(SURNAMES.length).toBeGreaterThanOrEqual(150);
    expect(STREETS.length).toBeGreaterThanOrEqual(40);
    expect(TOWNS.length).toBeGreaterThanOrEqual(15);
    expect(BANK_NAMES.length).toBeGreaterThanOrEqual(12);
  });

  it("hold no duplicates", () => {
    for (const pool of [
      FEMALE_FIRST_NAMES,
      MALE_FIRST_NAMES,
      SURNAMES,
      STREETS,
      BANK_NAMES,
      RIVERS,
    ]) {
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("start every street with Via, Viale, Piazza or Largo", () => {
    for (const street of STREETS) {
      expect(street).toMatch(/^(Via|Viale|Piazza|Largo) \S/);
    }
  });

  it("give every town a real-format CAP, Belfiore code and province", () => {
    for (const town of TOWNS) {
      expect(town.postCode).toMatch(/^3[34]\d{3}$/);
      expect(town.belfiore).toMatch(/^[A-Z]\d{3}$/);
      expect(town.province).toMatch(/^(UD|PN|TS|GO)$/);
    }

    expect(TOWNS).toContainEqual({
      name: "Udine",
      postCode: "33100",
      belfiore: "L483",
      province: "UD",
    });
  });

  it("fill every company template with known placeholders only", () => {
    const forms = [
      ...GENERIC_COMPANY_FORMS,
      ...COMPANY_PATTERNS.flatMap((p) => {
        return p.forms;
      }),
    ];

    for (const form of forms) {
      expect(form.replace(/\{(surname|river|legal|bank)\}/g, "")).not.toMatch(
        /[{}]/,
      );
    }

    expect(LEGAL_FORMS.length).toBeGreaterThanOrEqual(4);
  });
});
