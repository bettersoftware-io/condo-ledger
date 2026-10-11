import { describe, expect, it } from "vitest";

import {
  address,
  companyCore,
  companyIdentity,
  personIdentity,
  streetLine,
} from "./identity.ts";
import {
  BANK_NAMES,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  SURNAMES,
  TOWNS,
} from "./names.ts";
import { rngFor } from "./random.ts";

describe("personIdentity", () => {
  it("is deterministic for the same generator seed", () => {
    expect(personIdentity("f", rngFor("person", "3"))).toEqual(
      personIdentity("f", rngFor("person", "3")),
    );
  });

  it("gives different ids different identities", () => {
    const names = new Set<string>();

    for (let id = 1; id <= 30; id++) {
      const p = personIdentity("m", rngFor("person", String(id)));
      names.add(`${p.lastName} ${p.firstName}`);
    }

    expect(names.size).toBeGreaterThan(25);
  });

  it("draws first names of the given sex and a surname from the pool", () => {
    const woman = personIdentity("f", rngFor("person", "1"));
    const man = personIdentity("m", rngFor("person", "1"));

    expect(woman.sex).toBe("f");
    expect(FEMALE_FIRST_NAMES).toContain(woman.firstName);
    expect(FEMALE_FIRST_NAMES).toContain(woman.middleName);
    expect(man.sex).toBe("m");
    expect(MALE_FIRST_NAMES).toContain(man.firstName);
    expect(SURNAMES).toContain(man.lastName);
  });

  it("picks a sex when the record has none", () => {
    const sexes = new Set<string>();

    for (let id = 1; id <= 20; id++) {
      sexes.add(personIdentity(null, rngFor("person", String(id))).sex);
    }

    expect([...sexes].sort()).toEqual(["f", "m"]);
  });

  it("is an adult born between 1930 and 1995, in a Friuli town", () => {
    for (let id = 1; id <= 50; id++) {
      const p = personIdentity("f", rngFor("person", String(id)));
      const [year, month, day] = p.birthDate.split("-").map(Number);

      expect(p.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(year).toBeGreaterThanOrEqual(1930);
      expect(year).toBeLessThanOrEqual(1995);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(28);
      expect(TOWNS).toContainEqual(p.birthPlace);
    }
  });
});

describe("address", () => {
  it("is a street of the pool, a civic number and a real town", () => {
    const a = address(rngFor("address", "1"));

    expect(a.civic).toMatch(/^\d{1,3}$/);
    expect(Number(a.civic)).toBeGreaterThanOrEqual(1);
    expect(Number(a.civic)).toBeLessThanOrEqual(150);
    expect(TOWNS).toContainEqual(a.town);
    expect(streetLine(a)).toBe(`${a.streetName}, ${a.civic}`);
  });

  it("is deterministic", () => {
    expect(address(rngFor("address", "9"))).toEqual(
      address(rngFor("address", "9")),
    );
  });
});

describe("companyIdentity", () => {
  it("names a company after its category", () => {
    expect(companyIdentity("Fornitura acqua", rngFor("c", "1")).name).toMatch(
      /^Acque/,
    );
    expect(
      companyIdentity("Impresa di pulizie", rngFor("c", "2")).name,
    ).toMatch(/Pulizi/);
    expect(
      companyIdentity("Manutenzione ascensori", rngFor("c", "3")).name,
    ).toMatch(/Ascensori|Elevatori/);
    expect(companyIdentity("Avvocato", rngFor("c", "4")).name).toMatch(
      /^Studio Legale /,
    );
    expect(BANK_NAMES).toContain(
      companyIdentity("Istituto di credito", rngFor("c", "5")).name,
    );
  });

  it("falls back to a generic firm for an unknown category", () => {
    const company = companyIdentity("Altro", rngFor("c", "6"));

    expect(company.name).not.toMatch(/[{}]/);
    expect(company.name.length).toBeGreaterThan(5);
  });

  it("derives a short upper-case code and a slug", () => {
    for (let id = 1; id <= 20; id++) {
      const company = companyIdentity("Elettricista", rngFor("c", String(id)));

      expect(company.code).toMatch(/^[A-Z0-9]{2,6}$/);
      expect(company.slug).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("is deterministic", () => {
    expect(companyIdentity("Giardiniere", rngFor("c", "8"))).toEqual(
      companyIdentity("Giardiniere", rngFor("c", "8")),
    );
  });
});

describe("companyCore", () => {
  it("strips the legal form and the '& C.' companion", () => {
    expect(companyCore("Zanin S.r.l.")).toBe("Zanin");
    expect(companyCore("Acque Torre SpA")).toBe("Acque Torre");
    expect(companyCore("Torre Gas S.p.A")).toBe("Torre Gas");
    expect(companyCore("Pulizie Moro soc. coop. r.l.")).toBe("Pulizie Moro");
    expect(companyCore("GAS.ME. soc.coop.r.l.")).toBe("GAS.ME.");
    expect(companyCore("Ferramenta Bon & C. S.a.s")).toBe("Ferramenta Bon");
    expect(companyCore("Lizzi Impianti Srl")).toBe("Lizzi Impianti");
  });

  it("leaves a name without a trailing legal form alone", () => {
    expect(companyCore("Studio Rizzi")).toBe("Studio Rizzi");
    expect(companyCore("Tecno Snc di Bassi Aldo")).toBe(
      "Tecno Snc di Bassi Aldo",
    );
  });
});
