import { slugOf } from "./codes.ts";
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
  type Town,
} from "./names.ts";
import { intBetween, pick, type Rng } from "./random.ts";

export interface FakeAddress {
  streetName: string; // "Via Cavour"
  civic: string; // "12"
  town: Town;
}

export interface PersonIdentity {
  sex: "m" | "f";
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string; // ISO date
  birthPlace: Town;
  address: FakeAddress;
}

export interface CompanyIdentity {
  name: string;
  slug: string; // for e-mail domains and web sites
  code: string; // the short mnemonic of the registry ("ZANIN")
  address: FakeAddress;
}

// A legal form at the end of a company name, with its optional "& C."
// companion: "S.p.A", "Srl", "soc. coop. r.l.", "& C. S.a.s" …
const TRAILING_LEGAL_FORM =
  /(?:[\s,]+(?:s\.?\s?p\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|soc\.?\s?coop\.?(?:\s?(?:a\s)?r\.?\s?l\.?)?|&\s?c\.?))+$/i;

/**
 * A fake adult. The draws always happen in the same order (sex, names, birth,
 * address), so one generator seed always yields the same person.
 */
export function personIdentity(
  sex: "m" | "f" | null,
  rng: Rng,
): PersonIdentity {
  const chosenSex = sex ?? (rng() < 0.5 ? "f" : "m");
  const firstNames = chosenSex === "f" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const firstName = pick(firstNames, rng);
  const middleName = pick(firstNames, rng);
  const lastName = pick(SURNAMES, rng);
  const year = intBetween(1930, 1995, rng);
  const month = intBetween(1, 12, rng);
  const day = intBetween(1, 28, rng);
  const birthDate = `${String(year)}-${pad2(month)}-${pad2(day)}`;
  const birthPlace = pick(TOWNS, rng);
  return {
    sex: chosenSex,
    firstName,
    middleName,
    lastName,
    birthDate,
    birthPlace,
    address: address(rng),
  };
}

/** A fake firm whose name fits its master-data category ("Fornitura acqua" → "Acquedotto …"). */
export function companyIdentity(
  categoryName: string,
  rng: Rng,
): CompanyIdentity {
  const key = slugOfCategory(categoryName);
  const pattern = COMPANY_PATTERNS.find((p) => {
    return p.keyword.test(key);
  });
  const form = pick(pattern?.forms ?? GENERIC_COMPANY_FORMS, rng);
  let distinctive = "";

  function fill(placeholder: string): string {
    const value = drawPlaceholder(placeholder, rng);

    if (distinctive === "" && placeholder !== "legal") {
      distinctive = placeholder === "bank" ? initials(value) : value;
    }

    return value;
  }

  const name = form.replace(/\{(\w+)\}/g, (_match, placeholder: string) => {
    return fill(placeholder);
  });
  return {
    name,
    slug: slugOf(companyCore(name)),
    code: slugOf(distinctive).toUpperCase().slice(0, 6),
    address: address(rng),
  };
}

export function address(rng: Rng): FakeAddress {
  return {
    streetName: pick(STREETS, rng),
    civic: String(intBetween(1, 150, rng)),
    town: pick(TOWNS, rng),
  };
}

/** "Via Cavour, 12": the street as the legacy AddressVO stores it. */
export function streetLine(a: FakeAddress): string {
  return `${a.streetName}, ${a.civic}`;
}

/** A company name without its trailing legal form: "Zanin S.r.l." → "Zanin". */
export function companyCore(name: string): string {
  return name.replace(TRAILING_LEGAL_FORM, "").trim();
}

function drawPlaceholder(placeholder: string, rng: Rng): string {
  switch (placeholder) {
    case "surname":
      return pick(SURNAMES, rng);
    case "river":
      return pick(RIVERS, rng);
    case "bank":
      return pick(BANK_NAMES, rng);
    default:
      return pick(LEGAL_FORMS, rng);
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => {
      return word.length >= 3;
    })
    .map((word) => {
      return word.charAt(0);
    })
    .join("");
}

function slugOfCategory(categoryName: string): string {
  return categoryName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
