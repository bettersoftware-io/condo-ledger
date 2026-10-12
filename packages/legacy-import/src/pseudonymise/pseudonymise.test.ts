import { describe, expect, it } from "vitest";

import { parseAddressVO } from "../addressVO.ts";
import type { Row, Tables } from "../loadRows.ts";
import { fiscalCode, slugOf } from "./codes.ts";
import { companyCore } from "./identity.ts";
import { EXTRA_ENTRIES } from "./leftovers.ts";
import { BANK_NAMES, STREETS, SURNAMES, TOWNS } from "./names.ts";
import { serializeAddressVO } from "./phpSerialized.ts";
import { pseudonymiseTables } from "./pseudonymise.ts";

describe("pseudonymiseTables", () => {
  it("does not mutate its input and is deterministic", () => {
    const tables = createTables();
    const before = JSON.stringify(tables);
    const first = pseudonymiseTables(tables);

    expect(JSON.stringify(tables)).toBe(before);
    expect(JSON.stringify(pseudonymiseTables(createTables()))).toBe(
      JSON.stringify(first),
    );
  });

  it("gives each person a new name and uses it in every table", () => {
    const out = pseudonymiseTables(createTables());
    const mario = rowOf(out, "person", "masterDataId", "3");
    const irene = rowOf(out, "person", "masterDataId", "4");

    expect(mario.firstName).not.toBe("Mario");
    expect(SURNAMES).toContain(mario.lastName);
    expect(`${s(irene.lastName)} ${s(irene.firstName)}`).not.toBe(
      `${s(mario.lastName)} ${s(mario.firstName)}`,
    );
    expect(rowOf(out, "ledgerTransaction", "id", "1").description).toBe(
      `Incasso Rate da ${s(mario.lastName)} ${s(mario.firstName)}: Rata 1`,
    );
    expect(
      rowOf(out, "personVariation", "masterDataVariationId", "1"),
    ).toMatchObject({
      firstName: mario.firstName,
      lastName: mario.lastName,
    });
  });

  it("rewrites names in ALL CAPS and sweeps identifiers in free text", () => {
    const out = pseudonymiseTables(createTables());
    const mario = rowOf(out, "person", "masterDataId", "3");
    const irene = rowOf(out, "person", "masterDataId", "4");
    const text = s(rowOf(out, "ledgerTransaction", "id", "3").description);

    expect(text).toMatch(
      new RegExp(
        `^${s(mario.lastName).toUpperCase()} e ${s(irene.lastName)} ${s(irene.firstName)}, tel 347-\\d{7}$`,
      ),
    );
    expect(text).not.toContain("1234567");
  });

  it("keeps a valid fiscal code built on the fake identity, and opaque codes", () => {
    const out = pseudonymiseTables(createTables());
    const mario = rowOf(out, "person", "masterDataId", "3");
    const birthTown = TOWNS.find((t) => {
      return t.name === parseAddressVO(s(mario.birthPlace)).cityName;
    });

    expect(birthTown).toBeDefined();
    expect(mario.birthDate).not.toBe("1950-01-01");
    expect(rowOf(out, "masterData", "id", "3")).toMatchObject({
      code: "PRS231",
      taxCode: fiscalCode(
        s(mario.lastName),
        s(mario.firstName),
        "m",
        s(mario.birthDate),
        birthTown?.belfiore ?? "",
      ),
    });
    expect(rowOf(out, "masterDataVariation", "id", "1").taxCode).toBe(
      rowOf(out, "masterData", "id", "3").taxCode,
    );
  });

  it("derives a name-shaped code from the pseudonym", () => {
    const out = pseudonymiseTables(createTables());
    const irene = rowOf(out, "person", "masterDataId", "4");

    expect(rowOf(out, "masterData", "id", "4").code).toBe(
      `${slugOf(s(irene.firstName)).charAt(0)}${slugOf(s(irene.lastName))}`
        .toUpperCase()
        .slice(0, 6),
    );
  });

  it("renames a firm after its category, everywhere, and keeps a building's own entry", () => {
    const out = pseudonymiseTables(createTables());
    const firm = s(rowOf(out, "company", "masterDataId", "17").name);

    expect(firm).toMatch(/^Acque/);
    expect(rowOf(out, "ledgerTransaction", "id", "2").description).toBe(
      `Registrazione fattura ${companyCore(firm)} S.p.A n. 4`,
    );
    expect(rowOf(out, "company", "masterDataId", "19").name).toBe(
      "Condomìnio Alfa",
    );
    expect(rowOf(out, "masterData", "id", "17").vatNumber).toMatch(
      /^IT\d{11}$/,
    );
    expect(rowOf(out, "masterData", "id", "17").vatNumber).not.toBe(
      "IT00743110157",
    );
  });

  it("gives every firm a distinct registry code, even when names share a word", () => {
    const tables: Tables = {
      masterDataCategory: [{ id: "17", name: "Fornitura acqua" }],
      masterData: [],
      company: [],
    };

    for (let id = 1; id <= 20; id++) {
      tables.masterData?.push({
        id: String(id),
        code: `W${String(id)}X`,
        masterDataCategoryId: "17",
      });
      tables.company?.push({
        masterDataId: String(id),
        name: `Acque ${String(id)}`,
      });
    }

    const codes = (pseudonymiseTables(tables).masterData ?? []).map((m) => {
      return s(m.code);
    });

    expect(new Set(codes).size).toBe(20);

    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{2,6}$/);
    }
  });

  it("rewrites contacts by type", () => {
    const out = pseudonymiseTables(createTables());
    const mario = rowOf(out, "person", "masterDataId", "3");

    expect(rowOf(out, "masterDataContact", "id", "1").value).toMatch(
      /^\+39 3\d{2} \d{7}$/,
    );
    expect(rowOf(out, "masterDataContact", "id", "2").value).toBe(
      `${slugOf(s(mario.firstName))}.${slugOf(s(mario.lastName))}@posta.example`,
    );
    expect(rowOf(out, "masterDataContact", "id", "6").value).toBe(
      `${slugOf(s(mario.firstName))}.${slugOf(s(mario.lastName))}2@posta.example`,
    );
    expect(rowOf(out, "masterDataContact", "id", "3").value).toMatch(
      /^www\.[a-z0-9]+\.example$/,
    );
    expect(rowOf(out, "masterDataContact", "id", "4").value).toMatch(
      /^[a-z0-9.]+@pec\.posta\.example$/,
    );
    expect(rowOf(out, "masterDataContact", "id", "5").value).toMatch(
      /^0432 \d{6}$/,
    );
    expect(rowOf(out, "masterDataContact", "id", "1").label).toBe("Cellulare");
  });

  it("moves every address to a fake street, a building's groups along with it", () => {
    const out = pseudonymiseTables(createTables());
    const home = parseAddressVO(
      s(rowOf(out, "masterData", "id", "3").postalAddress),
    );

    const building = parseAddressVO(
      s(rowOf(out, "condominium", "id", "1").address),
    );
    const stair = parseAddressVO(s(rowOf(out, "unitGroup", "id", "1").address));
    const [streetName, civic] = (building.street ?? "").split(", ");

    expect(STREETS).toContain(home.street?.split(", ")[0]);
    expect(STREETS).toContain(streetName);
    expect(stair.street).toBe(`${streetName ?? ""}, ${civic ?? ""}/a`);
    expect(stair.postCode).toBe(building.postCode);
    expect(rowOf(out, "condominium", "id", "1")).toMatchObject({
      name: "Alfa",
      code: "ALF",
    });
  });

  it("redraws the parcel numbers of a cadastral reference and keeps its category and class", () => {
    const out = pseudonymiseTables(createTables());
    const building = rowOf(out, "condominium", "id", "1");
    const unit = s(rowOf(out, "unit", "id", "1").landRegistry);

    expect(building.landRegistry).toMatch(
      /^Sezione = A; Foglio = \d{2}; Particella = \d{3}; Categoria = C\/6; Classe = 2; Sub = \d$/,
    );
    expect(building.landRegistry).not.toContain(
      "Foglio = 33; Particella = 346",
    );
    expect(unit).toMatch(/^Mapp\. \d{3}, Sup\. \d{2}-\d{2}$/);
    expect(unit).not.toContain("512");
  });

  it("redraws a building's fiscal code", () => {
    const building = rowOf(
      pseudonymiseTables(createTables()),
      "condominium",
      "id",
      "1",
    );

    expect(building.taxCode).toMatch(/^\d{9}$/);
    expect(building.taxCode).not.toBe("582917364");
  });

  it("keeps lookup and label tables as they are", () => {
    const tables = createTables();
    const out = pseudonymiseTables(tables);

    expect(out.qualification).toEqual(tables.qualification);
    expect(out.unitType).toEqual(tables.unitType);
  });

  it("replaces a building's real town and the known leftovers in free text", () => {
    const out = pseudonymiseTables(createTables());
    const town = parseAddressVO(
      s(rowOf(out, "condominium", "id", "1").address),
    ).cityName;
    const policy = s(rowOf(out, "calendarEvent", "id", "1").description);
    const bank = s(rowOf(out, "ledgerAccount", "id", "2").name);

    expect(rowOf(out, "ledgerAccount", "id", "1").name).toBe(
      `Diritti segreteria Comune ${town ?? ""}`,
    );
    expect(BANK_NAMES).toContain(bank.split(" - ")[0]);
    expect(bank).toMatch(/ - C\/C \d{4}\.\d{2}$/);
    expect(BANK_NAMES).toContain(
      s(rowOf(out, "ledgerAccount", "id", "3").name).split(" - ")[0],
    );
    expect(policy).toMatch(/^Scadenza polizza assicurativa n\.\d{4} \S/);
    expect(policy).not.toContain("6153");

    for (const leftover of OTHER_LEFTOVERS) {
      expect(policy).not.toContain(leftover.original);
      expect(rowOf(out, "calendarEvent", "id", "1").notes).not.toContain(
        leftover.original,
      );
    }
  });

  it("gives a bank account one consistent fake IBAN and its holder's name", () => {
    const out = pseudonymiseTables(createTables());
    const account = rowOf(out, "bankAccount", "id", "7");
    const code = s(account.iban);

    expect(code).toBe(
      `IT${s(account.checkDigits)}${s(account.checkChar)}${s(account.nationalBankCode)}${s(account.branchCode)}${s(account.accountNumber)}`,
    );
    expect(mod97(`${code.slice(4)}${code.slice(0, 4)}`)).toBe(1);
    expect(code).not.toBe("IT60X0542811101000000123456");
    expect(account.holder).toBe("Condominio Alfa");
    expect(BANK_NAMES).toContain(account.bankName);
    expect(account.swift).toMatch(/^[A-Z]{4}IT[A-Z0-9]{5}$/);
    expect(account.code).toBe("xxx");
    expect(account.nationalCheckDigits).toBeNull();
  });

  it("rewrites bank branches and user names, and follows a user name across tables", () => {
    const out = pseudonymiseTables(createTables());
    const mario = rowOf(out, "person", "masterDataId", "3");
    const user = `${slugOf(s(mario.firstName))}.${slugOf(s(mario.lastName))}`;

    expect(rowOf(out, "bankBranch", "id", "1").name).toMatch(/^Agenzia di /);
    expect(
      parseAddressVO(s(rowOf(out, "bankBranch", "id", "1").address)).street,
    ).not.toBe("via Lunga, 7");
    expect(rowOf(out, "accessAccount", "masterDataId", "3").username).toBe(
      user,
    );
    expect(rowOf(out, "accessAccount", "masterDataId", "4").username).toBe(
      "000001",
    );
    expect(out.unitResidentAccount?.[0]?.systemUsername).toBe(user);
  });

  it("leaves amounts, ids and public reference tables alone", () => {
    const tables = createTables();
    const out = pseudonymiseTables(tables);

    expect(out.ledgerEntry).toEqual(tables.ledgerEntry);
    expect(out.distributionTableItem).toEqual(tables.distributionTableItem);
    expect(out.city).toEqual(tables.city);
    expect(out.masterDataCategory).toEqual(tables.masterDataCategory);
  });

  it("leaves no original name, code or address outside the reference tables", () => {
    const {
      city: _city,
      qualification: _qualification,
      unitType: _unitType,
      ...out
    } = pseudonymiseTables(createTables());
    const text = JSON.stringify(out);

    for (const original of [
      "Mario",
      "Zanin",
      "ZANIN",
      "Irene",
      "Bortoli",
      "Lumen",
      "RSSMRA80A01H501U",
      "00743110157",
      "IT60X0542811101000000123456",
      "000000123456",
      "1234567",
      "mario.zanin",
      "via Lunga",
      "via Corta",
      "Banca Vera",
      "Borgo Alto",
      "6153",
      ...EXTRA_ENTRIES.map((e) => {
        return e.original;
      }),
    ]) {
      expect(text).not.toContain(original);
    }
  });
});

function createTables(): Tables {
  return {
    masterDataCategory: [
      { id: "29", name: "Condòmino" },
      { id: "17", name: "Fornitura acqua" },
      { id: "31", name: "Condomìnio" },
    ],
    masterData: [
      {
        id: "3",
        code: "PRS231",
        masterDataCategoryId: "29",
        taxCode: "RSSMRA80A01H501U",
        vatNumber: null,
        postalAddress: blob("via Lunga, 7", "33100"),
        bankAccountId: null,
      },
      {
        id: "4",
        code: "MZANIN",
        masterDataCategoryId: "29",
        taxCode: null,
        vatNumber: null,
        postalAddress: null,
        bankAccountId: null,
      },
      {
        id: "17",
        code: "LUMEN",
        masterDataCategoryId: "17",
        taxCode: null,
        vatNumber: "IT00743110157",
        postalAddress: null,
        bankAccountId: null,
      },
      {
        id: "19",
        code: null,
        masterDataCategoryId: "31",
        taxCode: null,
        vatNumber: null,
        postalAddress: null,
        bankAccountId: null,
      },
    ],
    masterDataVariation: [
      {
        id: "1",
        masterDataId: "3",
        taxCode: "RSSMRA80A01H501U",
        vatNumber: null,
        postalAddress: blob("via Lunga, 7", "33100"),
      },
    ],
    person: [
      {
        masterDataId: "3",
        firstName: "Mario",
        middleName: null,
        lastName: "Zanin",
        sex: "m",
        birthDate: "1950-01-01",
        birthPlace: blob(null, "33100"),
        permanentAddress: blob("via Lunga, 7", "33100"),
        currentAddress: null,
        officeAddress: null,
      },
      {
        masterDataId: "4",
        firstName: "Irene",
        middleName: null,
        lastName: "De Bortoli",
        sex: "f",
        birthDate: null,
        birthPlace: null,
        permanentAddress: null,
        currentAddress: null,
        officeAddress: null,
      },
    ],
    personVariation: [
      { masterDataVariationId: "1", firstName: "Mario", lastName: "Zanin" },
    ],
    company: [
      {
        masterDataId: "17",
        name: "Lumen Acque S.p.A.",
        registeredOfficeAddress: blob("via Lunga, 9", "33100"),
        taxPurposeAddress: null,
      },
      {
        masterDataId: "19",
        name: "Condomìnio Alfa",
        registeredOfficeAddress: null,
        taxPurposeAddress: null,
      },
    ],
    masterDataContact: [
      contact("1", "3", "tel", "Cellulare", "+39 347 1234567"),
      contact("2", "3", "mail", "Email", "mario.zanin@example.com"),
      contact("6", "3", "mail", "Email", "zanin.mario@example.org"),
      contact("3", "17", "web", "Sito Web", "www.lumen.example.org"),
      contact("4", "17", "pec", "PEC", "lumen@pec.example.org"),
      contact("5", "3", "fax", "Fax", "0432 111222"),
    ],
    condominium: [
      {
        id: "1",
        name: "Alfa",
        code: "ALF",
        address: blob("via Corta, 4", "33100").replace(
          's:6:"cityId";N;',
          's:6:"cityId";i:77;',
        ),
        taxCode: "582917364",
        vatNumber: null,
        landRegistry:
          "Sezione = A; Foglio = 33; Particella = 346; Categoria = C/6; Classe = 2; Sub = 2",
        bankAccountId: "7",
      },
    ],
    accountingPeriod: [{ id: "1", condominiumId: "1" }],
    unitGroup: [
      {
        id: "1",
        accountingPeriodId: "1",
        name: "Scala A",
        address: blob("via Corta, 4/a", "33100"),
      },
    ],
    unit: [{ id: "1", code: "A1", landRegistry: "Mapp. 512, Sup. 31-32" }],
    bankAccount: [
      {
        id: "7",
        bankName: "Banca Vera",
        nationalBankCode: "05428",
        branchName: "Centro",
        branchCode: "11101",
        swift: "ABCDITMMXXX",
        branchAddress: blob("via Lunga, 1", "33100"),
        iban: "IT60X0542811101000000123456",
        code: "xxx",
        holder: "Condominio Beta",
        accountNumber: "000000123456",
        checkDigits: "60",
        checkChar: "X",
        nationalCheckDigits: null,
      },
    ],
    bankBranch: [
      { id: "1", name: "AG. 1", address: blob("via Lunga, 7", "33100") },
    ],
    ledgerTransaction: [
      { id: "1", description: "Incasso Rate da Zanin Mario: Rata 1" },
      {
        id: "2",
        description: "Registrazione fattura Lumen Acque S.p.A n. 4",
      },
      { id: "3", description: "ZANIN e De Bortoli Irene, tel 347-1234567" },
    ],
    ledgerEntry: [{ id: "1", ledgerTransactionId: "1", amount: "350.00" }],
    ledgerAccount: [
      { id: "1", name: "Diritti segreteria Comune Borgo Alto" },
      { id: "2", name: `${s(BANK_LEFTOVERS[0]?.original)} - C/C 1234.56` },
      { id: "3", name: `${s(BANK_LEFTOVERS.at(-1)?.original)} - c/c` },
    ],
    calendarEvent: [
      {
        id: "1",
        description: `Scadenza polizza assicurativa n.6153 ${s(OTHER_LEFTOVERS[0]?.original)}`,
        notes: `Sarà sostituita dalla ditta ${s(OTHER_LEFTOVERS.at(-1)?.original)}.`,
      },
    ],
    qualification: [{ id: "1", name: "Zanin" }],
    unitType: [{ id: "1", name: "Irene" }],
    distributionTableItem: [
      { id: "1", coefficient: "300.000000" },
      { id: "2", coefficient: "3456789012.50" },
    ],
    accessAccount: [
      { username: "mario.zanin", masterDataId: "3" },
      { username: "000001", masterDataId: "4" },
    ],
    unitResidentAccount: [{ systemUsername: "mario.zanin" }],
    city: [
      { id: "1", name: "Zanin" },
      { id: "77", name: "Borgo Alto" },
    ],
  };
}

function blob(street: string | null, postCode: string): string {
  return serializeAddressVO({
    countryIso3166_1_a2: "IT",
    postCode,
    street,
    cityName: null,
  });
}

function contact(
  id: string,
  masterDataId: string,
  type: string,
  label: string,
  value: string,
): Row {
  return { id, masterDataId, type, label, value };
}

function rowOf(tables: Tables, table: string, key: string, id: string): Row {
  const row = (tables[table] ?? []).find((r) => {
    return r[key] === id;
  });

  if (!row) {
    throw new Error(`no ${table} row with ${key} = ${id}`);
  }

  return row;
}

function s(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mod97(text: string): number {
  let rest = 0;

  for (const ch of text) {
    const value = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);

    for (const digit of value) {
      rest = (rest * 10 + Number(digit)) % 97;
    }
  }

  return rest;
}

// The real leftovers live in leftovers.ts only; the fixtures take them from there.
const BANK_LEFTOVERS = EXTRA_ENTRIES.filter((e) => {
  return BANK_NAMES.includes(e.pseudonym);
});

const OTHER_LEFTOVERS = EXTRA_ENTRIES.filter((e) => {
  return !BANK_NAMES.includes(e.pseudonym);
});
