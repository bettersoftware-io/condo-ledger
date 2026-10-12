import { digits, pick, type Rng } from "./random.ts";

// Italian identifiers with their real formats and check characters, so a fake
// one validates like a real one. Pure functions: the randomness comes in as an
// Rng, nothing else.

const MONTH_LETTERS = "ABCDEHLMPRST";

// The odd-position values of the fiscal-code control character (and of the
// IBAN's CIN), indexed by digit 0-9 and by letter A-Z.
const ODD_DIGITS = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21];

const ODD_LETTERS = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10,
  22, 25, 24, 23,
];

// The provincial VAT offices of the region (FVG): Udine, Gorizia, Trieste,
// Pordenone.
const VAT_OFFICES = ["030", "031", "032", "093"];

const MOBILE_PREFIXES = [
  "320",
  "328",
  "329",
  "331",
  "333",
  "335",
  "338",
  "339",
  "340",
  "345",
  "347",
  "348",
  "349",
  "366",
  "380",
  "388",
  "392",
];

/** The 16-character codice fiscale of a person, check character included. */
export function fiscalCode(
  lastName: string,
  firstName: string,
  sex: "m" | "f",
  birthDate: string,
  belfiore: string,
): string {
  const [year, month, day] = birthDate.split("-");
  const dayNumber = Number(day) + (sex === "f" ? 40 : 0);
  const body = [
    surnamePart(lastName),
    namePart(firstName),
    (year ?? "").slice(2),
    MONTH_LETTERS[Number(month) - 1] ?? "",
    String(dayNumber).padStart(2, "0"),
    belfiore.toUpperCase(),
  ].join("");
  return `${body}${controlLetter(body)}`;
}

/** An 11-digit partita IVA from a Friuli office, with its check digit. */
export function vatNumber(rng: Rng): string {
  const first10 = `${String(1 + Math.floor(rng() * 9))}${digits(6, rng)}${pick(VAT_OFFICES, rng)}`;
  return `${first10}${String(vatCheckDigit(first10))}`;
}

/** An Italian IBAN: IT, mod-97 check digits, CIN, ABI (5), CAB (5), account (12). */
export function iban(abi: string, cab: string, account: string): string {
  const bban = `${abi}${cab}${account}`;
  const withCin = `${controlLetter(bban)}${bban}`;
  const check = 98 - mod97(`${withCin}IT00`);
  return `IT${String(check).padStart(2, "0")}${withCin}`;
}

/** A BIC shaped like an Italian bank's: 4 letters, IT, location, branch. */
export function swift(rng: Rng): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let bank = "";

  for (let i = 0; i < 4; i++) {
    bank += pick([...letters], rng);
  }

  const location = pick(["MM", "2U", "22", "3X", "2X"], rng);
  const branch = pick(["XXX", "1UD", "2TS", "3GO", "4PN"], rng);
  return `${bank}IT${location}${branch}`;
}

/** A Udine landline (0432 + 6 digits) or a mobile number (3xx + 7 digits). */
export function phone(kind: "mobile" | "landline", rng: Rng): string {
  if (kind === "mobile") {
    return `${pick(MOBILE_PREFIXES, rng)} ${digits(7, rng)}`;
  }

  return `0432 ${String(1 + Math.floor(rng() * 9))}${digits(5, rng)}`;
}

/** nome.cognome on the reserved .example domain: realistic, never delivered. */
export function email(firstName: string, lastName: string): string {
  return `${slugOf(firstName)}.${slugOf(lastName)}@posta.example`;
}

export function pec(localPart: string): string {
  return `${localPart}@pec.posta.example`;
}

export function website(name: string): string {
  return `www.${slugOf(name)}.example`;
}

/** Lower-case ASCII letters and digits only: accents folded, the rest dropped. */
export function slugOf(text: string): string {
  return foldAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function surnamePart(lastName: string): string {
  const letters = lettersOf(lastName);
  return `${consonants(letters)}${vowels(letters)}XXX`.slice(0, 3);
}

function namePart(firstName: string): string {
  const letters = lettersOf(firstName);
  const cons = consonants(letters);

  if (cons.length >= 4) {
    return `${cons[0] ?? ""}${cons[2] ?? ""}${cons[3] ?? ""}`;
  }

  return `${cons}${vowels(letters)}XXX`.slice(0, 3);
}

function lettersOf(text: string): string {
  return foldAccents(text)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function consonants(letters: string): string {
  return letters.replace(/[AEIOU]/g, "");
}

function vowels(letters: string): string {
  return letters.replace(/[^AEIOU]/g, "");
}

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

// Odd positions (1-based) take the ODD tables, even positions the plain value
// (digit 0-9, letter A-Z → 0-25); the sum modulo 26 is the letter.
function controlLetter(text: string): string {
  let sum = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const isDigit = ch >= "0" && ch <= "9";
    const index = isDigit ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 65;
    const odd = i % 2 === 0;

    if (odd) {
      sum += (isDigit ? ODD_DIGITS[index] : ODD_LETTERS[index]) ?? 0;
    } else {
      sum += index;
    }
  }

  return String.fromCharCode(65 + (sum % 26));
}

function vatCheckDigit(first10: string): number {
  let sum = 0;

  for (let i = 0; i < first10.length; i++) {
    const d = Number(first10.charAt(i));

    if (i % 2 === 0) {
      sum += d;
    } else {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  return (10 - (sum % 10)) % 10;
}

function mod97(text: string): number {
  let rest = 0;

  for (const ch of text) {
    const value = ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55);

    for (const digit of value) {
      rest = (rest * 10 + Number(digit)) % 97;
    }
  }

  return rest;
}
