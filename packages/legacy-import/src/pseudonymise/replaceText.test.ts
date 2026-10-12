import { describe, expect, it } from "vitest";

import type { Tables } from "../loadRows.ts";
import { EXTRA_ENTRIES } from "./leftovers.ts";
import { serializeAddressVO } from "./phpSerialized.ts";
import { replaceTextLines } from "./replaceText.ts";

describe("replaceTextLines", () => {
  it("rewrites full names both ways round, in their case and in ALL CAPS", () => {
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Zanin Mario(?!\w)==>Moro Elio`,
    );
    expect(lines).toContain(
      String.raw`regex:(?<!\w)ZANIN MARIO(?!\w)==>MORO ELIO`,
    );
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Mario Zanin(?!\w)==>Elio Moro`,
    );
  });

  it("rewrites a lone surname or first name only from five letters", () => {
    expect(lines).toContain(String.raw`regex:(?<!\w)Zanin(?!\w)==>Moro`);
    expect(lines).toContain(String.raw`regex:(?<!\w)Mario(?!\w)==>Elio`);
    expect(lines.join("\n")).not.toMatch(/\(\?<!\\w\)Ugo\(\?!\\w\)/);
    expect(lines.join("\n")).not.toMatch(/\(\?<!\\w\)Bon\(\?!\\w\)/);
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Bon Ugo(?!\w)==>Fabris Ivo`,
    );
  });

  it("gives a surname that is an ordinary word full-name rules only", () => {
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Conti Elio(?!\w)==>Rizzi Ivo`,
    );
    expect(lines).toContain(
      String.raw`regex:(?<!\w)CONTI ELIO(?!\w)==>RIZZI IVO`,
    );
    expect(lines.join("\n")).not.toMatch(/\(\?<!\\w\)(Conti|CONTI)\(\?!\\w\)/);
  });

  it("never gives a lone rule to a word of the label tables", () => {
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Vianello Remo(?!\w)==>Tavano Dino`,
    );
    expect(lines.join("\n")).not.toMatch(/\(\?<!\\w\)Vianello\(\?!\\w\)/);
  });

  it("escapes a firm's name and rewrites its core without the legal form", () => {
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Lumen Acque S\.p\.A\.(?!\w)==>Acque Torre S.p.A.`,
    );
    expect(lines).toContain(
      String.raw`regex:(?<!\w)Lumen Acque(?!\w)==>Acque Torre`,
    );
  });

  it("carries the fixed leftovers and the building's real town", () => {
    const leftover = EXTRA_ENTRIES.find((e) => {
      return /^[\p{L} ]+$/u.test(e.original);
    });

    expect(lines).toContain(
      String.raw`regex:(?<!\w)${leftover?.original ?? ""}(?!\w)==>${leftover?.pseudonym ?? ""}`,
    );
    expect(lines).toContain(String.raw`regex:(?<!\w)Borgo Alto(?!\w)==>Nimis`);
  });

  it("replaces identifiers and streets literally", () => {
    expect(lines).toContain(
      "literal:IT60X0542811101000000123456==>IT11A2222233333444444444444",
    );
    expect(lines).toContain("literal:01893456721==>09876543210");
    expect(lines).toContain(
      "literal:mario.zanin@example.com==>elio.moro@posta.example",
    );
    expect(lines).toContain("literal:via Lunga, 7==>Via Cavour, 12");
    expect(
      lines.some((l) => {
        return /^literal:347-50918273==>347-\d{8}$/.test(l);
      }),
    ).toBe(true);
  });

  it("skips a firm's name shorter than three letters, and a real town that is also a fake one", () => {
    expect(lines.join("\n")).not.toMatch(/\(\?<!\\w\)B\(\?!\\w\)/);
    expect(lines.join("\n")).not.toContain("Udine(?!");
  });

  it("skips placeholder numbers that would hit unrelated text", () => {
    expect(lines.join("\n")).not.toContain("literal:123456789==>");
  });

  it("orders longer originals first, so a full name goes before its surname", () => {
    const full = lines.indexOf(
      String.raw`regex:(?<!\w)Zanin Mario(?!\w)==>Moro Elio`,
    );
    const surname = lines.indexOf(String.raw`regex:(?<!\w)Zanin(?!\w)==>Moro`);

    expect(full).toBeGreaterThanOrEqual(0);
    expect(full).toBeLessThan(surname);
  });

  const lines = replaceTextLines(createOriginal(), createPseudonymised());
});

function createOriginal(): Tables {
  return {
    person: [
      { masterDataId: "3", firstName: "Mario", lastName: "Zanin" },
      { masterDataId: "4", firstName: "Ugo", lastName: "Bon" },
      { masterDataId: "5", firstName: "Elio", lastName: "Conti" },
      { masterDataId: "6", firstName: "Remo", lastName: "Vianello" },
    ],
    qualification: [{ id: "1", name: "Gentilissimo Vianello" }],
    company: [
      { masterDataId: "17", name: "Lumen Acque S.p.A." },
      { masterDataId: "18", name: "B" },
    ],
    masterData: [
      {
        id: "3",
        taxCode: null,
        vatNumber: null,
        postalAddress: address("via Lunga, 7", "33100"),
      },
      {
        id: "17",
        taxCode: null,
        vatNumber: "01893456721",
        postalAddress: null,
      },
    ],
    masterDataContact: [
      { id: "1", masterDataId: "3", value: "mario.zanin@example.com" },
    ],
    bankAccount: [
      {
        id: "7",
        iban: "IT60X0542811101000000123456",
        accountNumber: "000000123456",
      },
    ],
    condominium: [
      {
        id: "1",
        name: "Alfa",
        address: address("via Corta, 4", "33100").replace(
          's:6:"cityId";N;',
          's:6:"cityId";i:77;',
        ),
        taxCode: "123456789",
      },
      {
        id: "2",
        name: "Beta",
        address: address("via Stretta, 9", "33100").replace(
          's:6:"cityId";N;',
          's:6:"cityId";i:78;',
        ),
      },
    ],
    calendarEvent: [{ id: "1", notes: "chiamare il 347-50918273" }],
    city: [
      { id: "77", name: "Borgo Alto" },
      { id: "78", name: "Udine" },
    ],
  };
}

function createPseudonymised(): Tables {
  return {
    person: [
      { masterDataId: "3", firstName: "Elio", lastName: "Moro" },
      { masterDataId: "4", firstName: "Ivo", lastName: "Fabris" },
      { masterDataId: "5", firstName: "Ivo", lastName: "Rizzi" },
      { masterDataId: "6", firstName: "Dino", lastName: "Tavano" },
    ],
    company: [
      { masterDataId: "17", name: "Acque Torre S.p.A." },
      { masterDataId: "18", name: "Impresa Zof s.r.l." },
    ],
    masterData: [
      {
        id: "3",
        taxCode: null,
        vatNumber: null,
        postalAddress: address("Via Cavour, 12", "33017"),
      },
      {
        id: "17",
        taxCode: null,
        vatNumber: "09876543210",
        postalAddress: null,
      },
    ],
    masterDataContact: [
      { id: "1", masterDataId: "3", value: "elio.moro@posta.example" },
    ],
    bankAccount: [
      {
        id: "7",
        iban: "IT11A2222233333444444444444",
        accountNumber: "444444444444",
      },
    ],
    condominium: [
      {
        id: "1",
        name: "Alfa",
        address: serializeAddressVO({
          countryIso3166_1_a2: "IT",
          postCode: "33045",
          street: "Via Roma, 3",
          cityName: "Nimis",
        }),
        taxCode: "987654321",
      },
      {
        id: "2",
        name: "Beta",
        address: serializeAddressVO({
          countryIso3166_1_a2: "IT",
          postCode: "33017",
          street: "Via Trento, 5",
          cityName: "Tarcento",
        }),
      },
    ],
    calendarEvent: [{ id: "1", notes: "chiamare il 347-00000000" }],
    city: [{ id: "77", name: "Borgo Alto" }],
  };
}

function address(street: string, postCode: string): string {
  return serializeAddressVO({
    countryIso3166_1_a2: "IT",
    postCode,
    street,
    cityName: null,
  });
}
