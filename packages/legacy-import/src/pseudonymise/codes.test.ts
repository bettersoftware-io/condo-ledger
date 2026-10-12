import { describe, expect, it } from "vitest";

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
import { mulberry32 } from "./random.ts";

describe("fiscalCode", () => {
  it("computes the textbook code of Mario Rossi, born in Rome on 1 Jan 1980", () => {
    // RSS (surname consonants) MRA (name: 2 consonants + first vowel)
    // 80 A (January) 01 H501 (Roma). Control: odd positions R8 S12 R8 8→19 A1
    // 1→0 5→13 1→0, even positions S18 M12 A0 0 0 H7 0 → sum 98, 98 % 26 = 20 → U.
    expect(fiscalCode("Rossi", "Mario", "m", "1980-01-01", "H501")).toBe(
      "RSSMRA80A01H501U",
    );
  });

  it("adds 40 to the day for a woman and uses the month letter", () => {
    // RSS MRA 85 L (July) 55 (15 + 40) L483 (Udine). Control: odd R8 S12 R8
    // 8→19 L4 5→13 4→9 3→7, even S18 M12 A0 5 5 L11 8 → sum 139 % 26 = 9 → J.
    expect(fiscalCode("Rossi", "Maria", "f", "1985-07-15", "L483")).toBe(
      "RSSMRA85L55L483J",
    );
  });

  it("takes the 1st, 3rd and 4th consonant of a name with four or more, and pads a short surname with X", () => {
    // FOX (F + O + X pad) GFR (G-N-F-R-N-C → 1st, 3rd, 4th) 50 T (December) 31 L050.
    // Control: odd F13 X25 F13 5→13 T14 1→0 0→1 0→1, even O14 G6 R17 0 3 L11 5
    // → sum 136 % 26 = 6 → G.
    expect(fiscalCode("Fo", "Gianfranco", "m", "1950-12-31", "L050")).toBe(
      "FOXGFR50T31L050G",
    );
  });

  it("ignores accents, apostrophes and spaces", () => {
    expect(
      fiscalCode("D'Àgostini", "Nicolò", "m", "1970-03-09", "L483").slice(0, 6),
    ).toBe(
      fiscalCode("Dagostini", "Nicolo", "m", "1970-03-09", "L483").slice(0, 6),
    );
    expect(fiscalCode("Della Mea", "Ida", "f", "1960-05-02", "L483")).toMatch(
      /^DLLDIA60E42L483[A-Z]$/,
    );
  });
});

describe("vatNumber", () => {
  it("draws 11 digits whose last is the Luhn-style check digit", () => {
    const rng = mulberry32(5);

    for (let i = 0; i < 100; i++) {
      const v = vatNumber(rng);

      expect(v).toMatch(/^\d{11}$/);
      expect(Number(v[10])).toBe(expectedVatCheck(v.slice(0, 10)));
    }
  });

  it("validates a published number with the test's own check (oracle sanity)", () => {
    // 00743110157: odd positions 0+7+3+1+1 = 12; even 0, 4→8, 1→2, 0, 5→10→1 = 11;
    // (10 - 23 % 10) % 10 = 7.
    expect(expectedVatCheck("0074311015")).toBe(7);
  });
});

describe("iban", () => {
  it("reproduces the Italian IBAN of the ECBS published example", () => {
    expect(iban("05428", "11101", "000000123456")).toBe(
      "IT60X0542811101000000123456",
    );
  });

  it("produces check digits that pass mod-97", () => {
    const rng = mulberry32(9);

    for (let i = 0; i < 50; i++) {
      const abi = String(Math.floor(rng() * 1e5)).padStart(5, "0");
      const cab = String(Math.floor(rng() * 1e5)).padStart(5, "0");
      const account = String(Math.floor(rng() * 1e12)).padStart(12, "0");
      const code = iban(abi, cab, account);

      expect(code).toMatch(/^IT\d{2}[A-Z]\d{22}$/);
      expect(mod97(`${code.slice(4)}${code.slice(0, 4)}`)).toBe(1);
    }
  });
});

describe("swift", () => {
  it("has the shape of an Italian BIC with a branch suffix", () => {
    const rng = mulberry32(2);

    for (let i = 0; i < 20; i++) {
      expect(swift(rng)).toMatch(/^[A-Z]{4}IT[A-Z0-9]{2}[A-Z0-9]{3}$/);
    }
  });
});

describe("phone", () => {
  it("draws a Friuli landline or a mobile number", () => {
    const rng = mulberry32(4);

    expect(phone("landline", rng)).toMatch(/^0432 \d{6}$/);
    expect(phone("mobile", rng)).toMatch(/^3\d{2} \d{7}$/);
  });
});

describe("email, pec, website", () => {
  it("builds undeliverable addresses on the reserved .example domain", () => {
    expect(email("Nicolò", "De Marchi")).toBe("nicolo.demarchi@posta.example");
    expect(pec("studio.zanin")).toBe("studio.zanin@pec.posta.example");
    expect(website("Idraulica Zanin")).toBe("www.idraulicazanin.example");
  });

  it("slugs to lower-case ASCII letters and digits only", () => {
    expect(slugOf("L'Ottica Della Pietra & C. 2")).toBe("lotticadellapietrac2");
  });
});

function expectedVatCheck(first10: string): number {
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    const d = Number(first10[i]);

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
    const value = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);

    for (const digit of value) {
      rest = (rest * 10 + Number(digit)) % 97;
    }
  }

  return rest;
}
