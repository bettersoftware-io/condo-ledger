import { type AddressFields, parseAddressVO } from "../addressVO.ts";
import type { Row, Tables } from "../loadRows.ts";
import {
  email,
  fiscalCode,
  iban,
  pec,
  phone,
  slugOf,
  swift,
  vatNumber,
  website,
} from "./codes.ts";
import {
  createNameMapping,
  type NameEntry,
  type NameMapping,
  replaceNames,
  sweepIdentifiers,
} from "./freeText.ts";
import {
  address,
  type CompanyIdentity,
  companyCore,
  companyIdentity,
  type FakeAddress,
  type PersonIdentity,
  personIdentity,
  streetLine,
} from "./identity.ts";
import { BANK_NAMES } from "./names.ts";
import {
  isSerialized,
  mapSerializedStrings,
  serializeAddressVO,
} from "./phpSerialized.ts";
import { digits, pick, type Rng, rngFor } from "./random.ts";

// Public registries carried in the dump (geography, the bank list): their
// names are not about anyone, and a surname that is also a town name must not
// rename the town.
const REFERENCE_TABLES = new Set([
  "bank",
  "city",
  "cityI18n",
  "cityPostCode",
  "country",
  "countryI18n",
  "district",
  "districtI18n",
  "locale",
  "localeI18n",
  "minorCivilDivision",
  "postCode",
  "state",
  "stateI18n",
]);

// Lookup and label tables: salutations, roles, unit types, tributes,
// withholding taxes, categories. A salutation that happens to be a surname is
// a word there, not a person.
export const LABEL_TABLES = new Set([
  "accountingPeriodInstallmentDefaultSettings",
  "grant",
  "masterDataCategory",
  "masterDataCategoryI18n",
  "propertyManagersAssociation",
  "qualification",
  "taxRelief",
  "tribute",
  "unitOwnershipScenario",
  "unitResidentPriority",
  "unitResidentRole",
  "unitResidentRoleI18n",
  "unitType",
  "withholdingTax",
]);

// Rewritten whole by its own rule below, so the free-text pass skips it.
const REWRITTEN_WHOLE = new Set(["bankBranch"]);

// A code made of a short prefix and a serial ("PRS231") says nothing about
// whom it names; a mnemonic ("EZANIN") does.
const OPAQUE_CODE = /^[A-Z]{1,4}\d+$/;

const MAX_DRAWS = 1000;

// "Foglio = 33", "Mapp. 787", "Sub = 2", "Sup. 17-18": the label, then the number.
const PARCEL_NUMBER =
  /(?<!\p{L})((?:Foglio|Fg\.?|Particella|Part\.?|Mappale|Mapp\.?|Subalterno|Sub\.?|Sup\.?)\s*[=:]?\s*)(\d[\d/-]*)/giu;

/** Who each master-data id becomes, and how free text is cleaned. */
interface Cast {
  people: Map<string, PersonIdentity>;
  firms: Map<string, CompanyIdentity>;
  nominativo: Map<string, string>;
  codes: Map<string, string>; // the new registry mnemonic, by master-data id
  mapping: NameMapping;
  buildings: Map<string, BuildingAddress>;
}

interface BuildingAddress {
  fake: FakeAddress;
  originalStreet: string; // "via dei Glicini" (without the civic number)
  originalCivic: string; // "4"
}

interface Original {
  tokens: string[]; // lower-cased names a fake must not contain
  streets: Set<string>; // lower-cased street lines a fake must not equal
}

/**
 * Replaces every identity in the legacy tables with a fake one: the same
 * master-data id always becomes the same fake person or firm, wherever it is
 * named. Ids, amounts, dates other than birth dates, building names and
 * categories are left alone. `extraEntries` adds names typed by hand in free
 * text that no master-data entry carries (see leftovers.ts). Returns new
 * tables; the input is not changed.
 */
export function pseudonymiseTables(
  tables: Tables,
  extraEntries: readonly NameEntry[] = [],
): Tables {
  const cast = castIdentities(tables, extraEntries);
  const out: Tables = {};

  for (const [name, rows] of Object.entries(tables)) {
    const rewrite = ROW_REWRITERS[name];
    const clean = isOutsideFreeText(name) ? null : cast.mapping;

    out[name] = rows.map((row) => {
      const cleaned = clean ? cleanRow(row, clean) : { ...row };
      return rewrite ? rewrite(cleaned, cast, tables) : cleaned;
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Casting: one fake identity per master-data id, in id order.
// ---------------------------------------------------------------------------

function castIdentities(
  tables: Tables,
  extraEntries: readonly NameEntry[],
): Cast {
  const persons = indexBy(tables.person, "masterDataId");
  const companies = indexBy(tables.company, "masterDataId");
  const categories = indexBy(tables.masterDataCategory, "id");
  const masterData = indexBy(tables.masterData, "id");
  const original = originalsOf(tables);
  const people = new Map<string, PersonIdentity>();
  const firms = new Map<string, CompanyIdentity>();
  const nominativo = new Map<string, string>();
  const entries: NameEntry[] = [];
  const taken = new Set<string>();
  const buildingNames = new Set(
    (tables.condominium ?? []).map((c) => {
      return text(c.name).toLowerCase();
    }),
  );

  const ids = [...new Set([...persons.keys(), ...companies.keys()])].sort(
    byNumber,
  );

  for (const id of ids) {
    const person = persons.get(id);
    const company = companies.get(id);

    if (person) {
      const fake = drawPerson(id, person, original, taken);
      people.set(id, fake);
      nominativo.set(id, `${fake.lastName} ${fake.firstName}`);
      entries.push(...personEntries(person, fake, buildingNames));
    } else if (company) {
      const categoryName = text(
        categories.get(text(masterData.get(id)?.masterDataCategoryId))?.name,
      );

      if (isBuildingCategory(categoryName)) {
        nominativo.set(id, text(company.name));
        continue;
      }

      const fake = drawCompany(id, categoryName, original, taken);
      firms.set(id, fake);
      nominativo.set(id, fake.name);
      entries.push(
        ...companyEntries(text(company.name), fake.name, buildingNames),
      );
    }
  }

  const buildings = buildingAddresses(tables, original);
  entries.push(
    ...userNameEntries(tables, people, firms),
    ...townEntries(tables, buildings, buildingNames),
    ...extraEntries,
  );
  return {
    people,
    firms,
    nominativo,
    codes: registryCodes(tables, people, firms),
    mapping: createNameMapping(entries),
    buildings,
  };
}

/** Each building's real town, by condominium id, read from its address's city id. */
export function buildingTowns(tables: Tables): Map<string, string> {
  const cities = indexBy(tables.city, "id");
  const out = new Map<string, string>();

  for (const building of tables.condominium ?? []) {
    const cityId = /s:6:"cityId";i:(\d+);/.exec(text(building.address))?.[1];
    const town = text(cities.get(cityId ?? "")?.name);

    if (town !== "") {
      out.set(text(building.id), town);
    }
  }

  return out;
}

// A building's real town named in free text ("Comune di <town>") would undo
// its fake address: it becomes the building's fake town. The first building
// in a town decides.
function townEntries(
  tables: Tables,
  buildings: Map<string, BuildingAddress>,
  buildingNames: Set<string>,
): NameEntry[] {
  const entries: NameEntry[] = [];
  const seen = new Set<string>();
  const towns = [...buildingTowns(tables).entries()].sort(([a], [b]) => {
    return byNumber(a, b);
  });

  for (const [id, town] of towns) {
    const fake = buildings.get(id)?.fake.town.name;

    if (fake && !seen.has(town) && !buildingNames.has(town.toLowerCase())) {
      seen.add(town);
      entries.push({ original: town, pseudonym: fake });
    }
  }

  return entries;
}

// A mnemonic made from a name ("EZANIN") is made again from the pseudonym, and
// kept distinct from every other code by a numeric suffix; an opaque serial
// ("PRS231") and a building's own code stay.
function registryCodes(
  tables: Tables,
  people: Map<string, PersonIdentity>,
  firms: Map<string, CompanyIdentity>,
): Map<string, string> {
  const codes = new Map<string, string>();
  const rows = [...(tables.masterData ?? [])].sort((a, b) => {
    return byNumber(text(a.id), text(b.id));
  });

  function isRenamed(row: Row): boolean {
    const id = text(row.id);
    const code = text(row.code);
    return (
      code !== "" &&
      !OPAQUE_CODE.test(code) &&
      (people.has(id) || firms.has(id))
    );
  }

  const used = new Set(
    rows
      .filter((row) => {
        return !isRenamed(row);
      })
      .map((row) => {
        return text(row.code);
      }),
  );

  for (const row of rows.filter(isRenamed)) {
    const id = text(row.id);
    const person = people.get(id);
    const base = person ? personCode(person) : (firms.get(id)?.code ?? "");
    codes.set(id, uniqueCode(base, used));
  }

  return codes;
}

function personCode(p: PersonIdentity): string {
  return `${slugOf(p.firstName).charAt(0)}${slugOf(p.lastName)}`
    .toUpperCase()
    .slice(0, 6);
}

function uniqueCode(base: string, used: Set<string>): string {
  let code = base;

  for (let n = 2; used.has(code); n++) {
    code = `${base.slice(0, 6 - String(n).length)}${String(n)}`;
  }

  used.add(code);
  return code;
}

function drawPerson(
  id: string,
  person: Row,
  original: Original,
  taken: Set<string>,
): PersonIdentity {
  const rng = rngFor("person", id);
  const sexRaw = text(person.sex).toLowerCase();
  const sex = sexRaw === "m" || sexRaw === "f" ? sexRaw : null;

  for (let i = 0; i < MAX_DRAWS; i++) {
    const fake = personIdentity(sex, rng);
    const fullName = `${fake.lastName} ${fake.firstName}`;
    const parts = [fake.firstName, fake.middleName, fake.lastName];

    if (
      !taken.has(fullName) &&
      parts.every((part) => {
        return isClean(part, original);
      }) &&
      isCleanAddress(fake.address, original)
    ) {
      taken.add(fullName);
      return fake;
    }
  }

  throw new Error(`pseudonymise: no clean identity for person ${id}`);
}

function drawCompany(
  id: string,
  categoryName: string,
  original: Original,
  taken: Set<string>,
): CompanyIdentity {
  const rng = rngFor("company", id);

  for (let i = 0; i < MAX_DRAWS; i++) {
    const fake = companyIdentity(categoryName, rng);

    if (
      !taken.has(fake.name) &&
      isClean(fake.name, original) &&
      isCleanAddress(fake.address, original)
    ) {
      taken.add(fake.name);
      return fake;
    }
  }

  throw new Error(`pseudonymise: no clean identity for company ${id}`);
}

// A fake must not contain an original name, even as part of a longer word.
function isClean(value: string, original: Original): boolean {
  const lower = value.toLowerCase();
  return original.tokens.every((token) => {
    return !lower.includes(token);
  });
}

function isCleanAddress(a: FakeAddress, original: Original): boolean {
  return (
    isClean(a.streetName, original) &&
    !original.streets.has(streetLine(a).toLowerCase())
  );
}

function originalsOf(tables: Tables): Original {
  const tokens = new Set<string>();

  for (const p of tables.person ?? []) {
    for (const value of [p.firstName, p.middleName, p.lastName]) {
      for (const word of text(value).split(/\s+/)) {
        if (word.length >= 3) {
          tokens.add(word.toLowerCase());
        }
      }
    }
  }

  const streets = new Set<string>();

  for (const [name, rows] of Object.entries(tables)) {
    if (isOutsideFreeText(name)) {
      continue;
    }

    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === "string" && value.includes("AddressVO")) {
          const street = streetOf(parseAddressVO(value));

          if (street !== "") {
            streets.add(street.toLowerCase());
          }
        }
      }
    }
  }

  return { tokens: [...tokens], streets };
}

function personEntries(
  person: Row,
  fake: PersonIdentity,
  buildingNames: Set<string>,
): NameEntry[] {
  const first = text(person.firstName).trim();
  const middle = text(person.middleName).trim();
  const last = text(person.lastName).trim();
  const pairs: [string, string][] = [
    [`${last} ${first}`, `${fake.lastName} ${fake.firstName}`],
    [`${first} ${last}`, `${fake.firstName} ${fake.lastName}`],
    [last, fake.lastName],
    [first, fake.firstName],
    [middle, fake.middleName],
  ];

  for (const word of last.split(/\s+/)) {
    pairs.push([word, fake.lastName]);
  }

  return pairs
    .filter(([from]) => {
      return from.trim() !== "" && !buildingNames.has(from.toLowerCase());
    })
    .map(([from, to]) => {
      return { original: from.trim(), pseudonym: to };
    });
}

function companyEntries(
  name: string,
  fake: string,
  buildingNames: Set<string>,
): NameEntry[] {
  const entries: NameEntry[] = [
    { original: name, pseudonym: fake, anyCase: true },
  ];
  const core = companyCore(name);

  if (core !== name && !buildingNames.has(core.toLowerCase())) {
    entries.push({
      original: core,
      pseudonym: companyCore(fake),
      anyCase: true,
    });
  }

  return entries;
}

// A login named after its owner ("elio.zanin", "ezanin2") becomes one named
// after the pseudonym; numeric logins say nothing and stay.
function userNameEntries(
  tables: Tables,
  people: Map<string, PersonIdentity>,
  firms: Map<string, CompanyIdentity>,
): NameEntry[] {
  const entries: NameEntry[] = [];

  for (const account of tables.accessAccount ?? []) {
    const username = text(account.username);
    const owner = text(account.masterDataId);
    const person = people.get(owner);
    const firm = firms.get(owner);

    if (/^\d*$/.test(username) || (!person && !firm)) {
      continue;
    }

    const suffix = /\d*$/.exec(username)?.[0] ?? "";
    const base = person
      ? `${slugOf(person.firstName)}.${slugOf(person.lastName)}`
      : (firm?.slug ?? "");

    const pseudonym = username.includes("@")
      ? `${base}${suffix}@posta.example`
      : `${base}${suffix}`;
    entries.push({ original: username, pseudonym });
  }

  return entries;
}

// The building's fake street, and the original one, so its stair wells and
// blocks on the same street move to the same fake street.
function buildingAddresses(
  tables: Tables,
  original: Original,
): Map<string, BuildingAddress> {
  const out = new Map<string, BuildingAddress>();

  for (const building of tables.condominium ?? []) {
    const id = text(building.id);
    const rng = rngFor("condominium", id);
    let fake = address(rng);

    for (let i = 0; i < MAX_DRAWS && !isCleanAddress(fake, original); i++) {
      fake = address(rng);
    }

    const [originalStreet, originalCivic] = splitStreet(
      streetOf(parseAddressVO(nullable(building.address))),
    );
    out.set(id, { fake, originalStreet, originalCivic });
  }

  return out;
}

// ---------------------------------------------------------------------------
// The free-text pass: every string of every row.
// ---------------------------------------------------------------------------

function cleanRow(row: Row, mapping: NameMapping): Row {
  const out: Row = {};

  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" ? cleanText(value, mapping) : value;
  }

  return out;
}

function cleanText(value: string, mapping: NameMapping): string {
  function clean(t: string): string {
    return sweepIdentifiers(replaceNames(t, mapping));
  }

  return isSerialized(value)
    ? mapSerializedStrings(value, clean)
    : clean(value);
}

// ---------------------------------------------------------------------------
// The identity columns, table by table.
// ---------------------------------------------------------------------------

type RowRewriter = (row: Row, cast: Cast, tables: Tables) => Row;

const ROW_REWRITERS: Record<string, RowRewriter> = {
  masterData: (row, cast) => {
    return rewriteMasterData(row, text(row.id), cast);
  },
  masterDataVariation: (row, cast) => {
    return rewriteMasterData(row, text(row.masterDataId), cast);
  },
  person: (row, cast) => {
    return rewritePerson(row, text(row.masterDataId), cast);
  },
  personVariation: (row, cast, tables) => {
    return rewritePerson(row, variationOwner(row, tables), cast);
  },
  company: (row, cast) => {
    return rewriteCompany(row, text(row.masterDataId), cast);
  },
  companyVariation: (row, cast, tables) => {
    return rewriteCompany(row, variationOwner(row, tables), cast);
  },
  masterDataContact: (row, cast, tables) => {
    return rewriteContact(row, cast, tables);
  },
  bankAccount: (row, cast, tables) => {
    return rewriteBankAccount(row, cast, tables);
  },
  bankBranch: (row) => {
    return rewriteBankBranch(row);
  },
  condominium: (row, cast) => {
    return rewriteCondominium(row, cast);
  },
  unitGroup: (row, cast, tables) => {
    return rewriteUnitGroup(row, cast, tables);
  },
  unit: (row) => {
    return {
      ...row,
      landRegistry: redrawParcels(
        row.landRegistry,
        rngFor("unit", text(row.id)),
      ),
    };
  },
};

function rewriteMasterData(row: Row, id: string, cast: Cast): Row {
  const person = cast.people.get(id);
  const firm = cast.firms.get(id);
  const rng = rngFor("masterData", id);
  const taxCode = nullable(row.taxCode);
  const vat = nullable(row.vatNumber);
  return {
    ...row,
    code: cast.codes.get(id) ?? row.code ?? null,
    taxCode:
      taxCode === null
        ? null
        : person && !/^\d+$/.test(taxCode)
          ? personFiscalCode(person)
          : vatNumber(rng),
    vatNumber:
      vat === null
        ? null
        : `${vat.startsWith("IT") ? "IT" : ""}${vatNumber(rng)}`,
    postalAddress: addressBlobOr(
      row.postalAddress,
      person?.address ??
        firm?.address ??
        address(rngFor("masterData.address", id)),
    ),
  };
}

function rewritePerson(row: Row, id: string, cast: Cast): Row {
  const fake = cast.people.get(id);

  if (!fake) {
    return row;
  }

  const birthPlace = nullable(row.birthPlace);
  return {
    ...row,
    firstName: keepNull(row.firstName, fake.firstName),
    middleName: keepNull(row.middleName, fake.middleName),
    lastName: keepNull(row.lastName, fake.lastName),
    birthDate: keepNull(row.birthDate, fake.birthDate),
    ...(birthPlace !== null && {
      birthPlace: serializeAddressVO({
        countryIso3166_1_a2: "IT",
        postCode: fake.birthPlace.postCode,
        street: null,
        cityName: fake.birthPlace.name,
      }),
    }),
    ...addressColumns(
      row,
      ["permanentAddress", "currentAddress"],
      fake.address,
    ),
    ...addressColumns(
      row,
      ["officeAddress"],
      address(rngFor("person.officeAddress", id)),
    ),
  };
}

function rewriteCompany(row: Row, id: string, cast: Cast): Row {
  const fake = cast.firms.get(id);
  return {
    ...row,
    name: fake ? fake.name : (row.name ?? null),
    ...addressColumns(
      row,
      ["registeredOfficeAddress", "taxPurposeAddress"],
      fake?.address ?? address(rngFor("company.address", id)),
    ),
  };
}

function rewriteContact(row: Row, cast: Cast, tables: Tables): Row {
  const value = nullable(row.value);

  if (value === null) {
    return row;
  }

  const owner = text(row.masterDataId);
  const person = cast.people.get(owner);
  const firm = cast.firms.get(owner);
  const rng = rngFor("masterDataContact", text(row.id));
  const prefix = value.startsWith("+39") ? "+39 " : "";
  const localPart = person
    ? `${slugOf(person.firstName)}.${slugOf(person.lastName)}`
    : (firm?.slug ?? slugOf(cast.nominativo.get(owner) ?? "contatto"));

  switch (text(row.type).toLowerCase()) {
    case "tel": {
      const mobile =
        /cell|mobil/i.test(text(row.label)) || /^(\+39\s?)?3/.test(value);
      return {
        ...row,
        value: `${prefix}${phone(mobile ? "mobile" : "landline", rng)}`,
      };
    }

    case "fax":
      return { ...row, value: `${prefix}${phone("landline", rng)}` };

    case "mail": {
      const ordinal = mailOrdinal(row, tables);
      const suffix = ordinal === 1 ? "" : String(ordinal);
      return {
        ...row,
        value: person
          ? email(person.firstName, `${person.lastName}${suffix}`)
          : `${pick(["info", "amministrazione", "segreteria"], rng)}${suffix}@${localPart}.example`,
      };
    }

    case "pec":
      return { ...row, value: pec(localPart) };
    case "web":
      return {
        ...row,
        value: website(
          person ? `${person.firstName}${person.lastName}` : localPart,
        ),
      };
    default:
      return row;
  }
}

// 1 for the owner's first e-mail contact (by id), 2 for the second, …
function mailOrdinal(row: Row, tables: Tables): number {
  const mine = (tables.masterDataContact ?? [])
    .filter((c) => {
      return (
        text(c.masterDataId) === text(row.masterDataId) &&
        text(c.type).toLowerCase() === "mail"
      );
    })
    .map((c) => {
      return text(c.id);
    })
    .sort(byNumber);
  return mine.indexOf(text(row.id)) + 1;
}

function rewriteBankAccount(row: Row, cast: Cast, tables: Tables): Row {
  const id = text(row.id);
  const rng = rngFor("bankAccount", id);
  const abi = digits(5, rng);
  const cab = digits(5, rng);
  const account = digits(12, rng);
  const bankName = pick(BANK_NAMES, rng);
  const bic = swift(rng);
  const branch = address(rng);
  const nationalCheck = digits(2, rng);
  const code = iban(abi, cab, account);
  return {
    ...row,
    bankName: keepNull(row.bankName, bankName),
    nationalBankCode: keepNull(row.nationalBankCode, abi),
    branchCode: keepNull(row.branchCode, cab),
    branchName: keepNull(row.branchName, branch.town.name),
    swift: keepNull(row.swift, bic),
    branchAddress: addressBlobOr(row.branchAddress, branch),
    iban: keepNull(row.iban, code),
    accountNumber: keepNull(row.accountNumber, account),
    checkDigits: keepNull(row.checkDigits, code.slice(2, 4)),
    checkChar: keepNull(row.checkChar, code.charAt(4)),
    nationalCheckDigits: keepNull(row.nationalCheckDigits, nationalCheck),
    holder: keepNull(row.holder, holderOf(id, row, cast, tables)),
  };
}

function holderOf(id: string, row: Row, cast: Cast, tables: Tables): string {
  const building = (tables.condominium ?? []).find((c) => {
    return text(c.bankAccountId) === id;
  });

  if (building) {
    return `Condominio ${text(building.name)}`;
  }

  const owner = (tables.masterData ?? []).find((m) => {
    return text(m.bankAccountId) === id;
  });
  return cast.nominativo.get(text(owner?.id)) ?? text(row.holder);
}

function rewriteBankBranch(row: Row): Row {
  const rng = rngFor("bankBranch", text(row.id));
  const branch = address(rng);
  const bic = swift(rng);
  const name = text(row.name);
  return {
    ...row,
    name: name === "" ? (row.name ?? null) : `Agenzia di ${branch.town.name}`,
    swift: keepNull(row.swift, bic),
    address: addressBlobOr(row.address, branch),
  };
}

function rewriteCondominium(row: Row, cast: Cast): Row {
  const id = text(row.id);
  const rng = rngFor("condominium.codes", id);
  const building = cast.buildings.get(id);
  const taxCode = nullable(row.taxCode);
  return {
    ...row,
    address: building
      ? addressBlobOr(row.address, building.fake)
      : (row.address ?? null),
    taxCode:
      taxCode !== null && /^\d{11}$/.test(taxCode)
        ? vatNumber(rng)
        : redigit(row.taxCode, rng),
    vatNumber: keepNull(row.vatNumber, vatNumber(rng)),
    landRegistry: redrawParcels(row.landRegistry, rng),
  };
}

// A stair well on its building's street follows the building to its fake
// street ("via X, 4/a" → "Via Cavour, 87/a"); any other gets its own.
function rewriteUnitGroup(row: Row, cast: Cast, tables: Tables): Row {
  const blob = nullable(row.address);

  if (blob === null) {
    return row;
  }

  const period = (tables.accountingPeriod ?? []).find((p) => {
    return text(p.id) === text(row.accountingPeriodId);
  });
  const building = cast.buildings.get(text(period?.condominiumId));
  const [street, civic] = splitStreet(streetOf(parseAddressVO(blob)));
  const own = address(rngFor("unitGroup", text(row.id)));

  if (!building) {
    return { ...row, address: addressBlob(own) };
  }

  const sameStreet =
    street !== "" &&
    street.toLowerCase() === building.originalStreet.toLowerCase();

  const fake: FakeAddress = sameStreet
    ? {
        streetName: building.fake.streetName,
        civic: civic.startsWith(building.originalCivic)
          ? `${building.fake.civic}${civic.slice(building.originalCivic.length)}`
          : own.civic,
        town: building.fake.town,
      }
    : { ...own, town: building.fake.town };
  return { ...row, address: addressBlob(fake) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function variationOwner(row: Row, tables: Tables): string {
  const variation = (tables.masterDataVariation ?? []).find((v) => {
    return text(v.id) === text(row.masterDataVariationId);
  });
  return text(variation?.masterDataId);
}

function personFiscalCode(p: PersonIdentity): string {
  return fiscalCode(
    p.lastName,
    p.firstName,
    p.sex,
    p.birthDate,
    p.birthPlace.belfiore,
  );
}

function addressColumns(
  row: Row,
  columns: readonly string[],
  fake: FakeAddress,
): Row {
  const out: Row = {};

  for (const column of columns) {
    if (column in row) {
      out[column] = addressBlobOr(row[column], fake);
    }
  }

  return out;
}

function addressBlobOr(
  current: Row[string] | undefined,
  fake: FakeAddress,
): Row[string] {
  return nullable(current) === null ? (current ?? null) : addressBlob(fake);
}

function addressBlob(fake: FakeAddress): string {
  return serializeAddressVO({
    countryIso3166_1_a2: "IT",
    postCode: fake.town.postCode,
    street: streetLine(fake),
    cityName: fake.town.name,
  });
}

export function streetOf(a: AddressFields): string {
  if (a.street !== undefined) {
    return a.street.trim();
  }

  return [a.streetName, a.streetNumber]
    .filter((part): part is string => {
      return part !== undefined && part !== "";
    })
    .join(", ")
    .trim();
}

// "via dei Glicini, 4/a" → ["via dei Glicini", "4/a"]
export function splitStreet(street: string): [string, string] {
  const comma = street.lastIndexOf(",");
  return comma === -1
    ? [street, ""]
    : [street.slice(0, comma).trim(), street.slice(comma + 1).trim()];
}

// Only the numbers that locate a parcel are redrawn (Foglio, Particella,
// Mappale, Sub, Sup.); Sezione, Categoria and Classe describe it and stay.
function redrawParcels(value: Row[string] | undefined, rng: Rng): Row[string] {
  const current = nullable(value);
  return current === null
    ? (value ?? null)
    : current.replace(
        PARCEL_NUMBER,
        (_match, label: string, digitsPart: string) => {
          return `${label}${digitsPart.replace(/\d/g, () => {
            return digits(1, rng);
          })}`;
        },
      );
}

function redigit(value: Row[string] | undefined, rng: Rng): Row[string] {
  const current = nullable(value);
  return current === null
    ? (value ?? null)
    : current.replace(/\d/g, () => {
        return digits(1, rng);
      });
}

// A column that was empty stays empty; one that held a value gets the fake.
function keepNull(current: Row[string] | undefined, fake: string): Row[string] {
  return current === null || current === undefined ? null : fake;
}

export function isOutsideFreeText(table: string): boolean {
  return (
    REFERENCE_TABLES.has(table) ||
    LABEL_TABLES.has(table) ||
    REWRITTEN_WHOLE.has(table)
  );
}

function isBuildingCategory(name: string): boolean {
  return slugOf(name) === "condominio";
}

function indexBy(rows: Row[] | undefined, key: string): Map<string, Row> {
  const out = new Map<string, Row>();

  for (const row of rows ?? []) {
    out.set(text(row[key]), row);
  }

  return out;
}

function nullable(value: Row[string] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function text(value: Row[string] | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function byNumber(a: string, b: string): number {
  return Number(a) - Number(b);
}
