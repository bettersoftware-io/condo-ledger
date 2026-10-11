import { describe, expect, it } from "vitest";

import {
  createNameMapping,
  identifierReplacements,
  type NameEntry,
  replaceNames,
  sweepIdentifiers,
} from "./freeText.ts";

const PEOPLE: NameEntry[] = [
  { original: "Zanin Tiziano", pseudonym: "Moro Elio" },
  { original: "Zanin", pseudonym: "Moro" },
  { original: "Tiziano", pseudonym: "Elio" },
  { original: "De Bortoli", pseudonym: "Cossio" },
  { original: "Bortoli", pseudonym: "Fabris" },
  { original: "Lidia", pseudonym: "Nadia" },
  { original: "Bo", pseudonym: "Plos" },
  { original: "Rizzi-Bon (C.)", pseudonym: "Zof" },
];

const FIRMS: NameEntry[] = [
  {
    original: "Lumen Gas S.p.A.",
    pseudonym: "Torre Gas S.p.A.",
    anyCase: true,
  },
  { original: "Lumen Gas", pseudonym: "Torre Gas", anyCase: true },
];

describe("replaceNames", () => {
  it("replaces a full name and single tokens on word boundaries", () => {
    expect(replaceNames("Incasso Rate da Zanin Tiziano: Rata 1", mapping)).toBe(
      "Incasso Rate da Moro Elio: Rata 1",
    );
    expect(replaceNames("nelle tabelle di Tiziano", mapping)).toBe(
      "nelle tabelle di Elio",
    );
  });

  it("handles a two-word surname, in ALL CAPS too", () => {
    expect(replaceNames("De Bortoli Lidia", mapping)).toBe("Cossio Nadia");
    expect(replaceNames("DE BORTOLI", mapping)).toBe("COSSIO");
    expect(replaceNames("ZANIN TIZIANO", mapping)).toBe("MORO ELIO");
  });

  it("treats regular-expression characters in a name literally", () => {
    expect(replaceNames("da Rizzi-Bon (C.) e Rizzi-Bon", mapping)).toBe(
      "da Zof e Rizzi-Bon",
    );
  });

  it("prefers the longest original at a position", () => {
    expect(replaceNames("De Bortoli", mapping)).toBe("Cossio");
    expect(replaceNames("Bortoli", mapping)).toBe("Fabris");
  });

  it("leaves a name inside a longer word, or in another case, alone", () => {
    expect(replaceNames("Zaninelli e Mariolina", mapping)).toBe(
      "Zaninelli e Mariolina",
    );
    expect(replaceNames("zanin", mapping)).toBe("zanin");
  });

  it("ignores tokens shorter than three letters", () => {
    expect(replaceNames("Bo", mapping)).toBe("Bo");
  });

  it("matches a firm's name in any case and keeps ALL CAPS", () => {
    expect(replaceNames("fattura Lumen Gas S.p.A. n. 3", mapping)).toBe(
      "fattura Torre Gas S.p.A. n. 3",
    );
    expect(replaceNames("fattura Lumen Gas S.p.A n. 3", mapping)).toBe(
      "fattura Torre Gas S.p.A n. 3",
    );
    expect(replaceNames("LUMEN GAS contratto", mapping)).toBe(
      "TORRE GAS contratto",
    );
    expect(replaceNames("lumen gas riscaldamento", mapping)).toBe(
      "Torre Gas riscaldamento",
    );
  });

  it("keeps the first pseudonym given for an original", () => {
    const m = createNameMapping([
      { original: "Paolo", pseudonym: "Ivo" },
      { original: "Paolo", pseudonym: "Remo" },
    ]);

    expect(replaceNames("Paolo", m)).toBe("Ivo");
  });

  it("orders originals of equal length by their code units, not by locale", () => {
    const m = createNameMapping([
      { original: "Zeta", pseudonym: "Uno" },
      { original: "zeta", pseudonym: "Due", anyCase: true },
    ]);

    expect(m.pattern?.source).toContain("(?i:zeta)|ZETA|Zeta|zeta");
  });

  it("returns the text unchanged when no name occurs, or the mapping is empty", () => {
    expect(replaceNames("Spese generali 2013", mapping)).toBe(
      "Spese generali 2013",
    );
    expect(replaceNames("Zanin", createNameMapping([]))).toBe("Zanin");
  });

  const mapping = createNameMapping([...PEOPLE, ...FIRMS]);
});

describe("sweepIdentifiers", () => {
  it("replaces a fiscal code with another valid-shaped one, the same each time", () => {
    const out = sweepIdentifiers("cf RSSMRA80A01H501U e RSSMRA80A01H501U");
    const [, first, second] =
      /^cf ([A-Z0-9]{16}) e ([A-Z0-9]{16})$/.exec(out) ?? [];

    expect(first).toMatch(/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/);
    expect(first).not.toBe("RSSMRA80A01H501U");
    expect(second).toBe(first);
    expect(sweepIdentifiers("RSSMRA80A01H501U")).toBe(first);
  });

  it("replaces an IBAN with a valid one, keeping its spacing", () => {
    const compact = sweepIdentifiers("IT60X0542811101000000123456");

    expect(compact).toMatch(/^IT\d{2}[A-Z]\d{22}$/);
    expect(compact).not.toBe("IT60X0542811101000000123456");
    expect(mod97(`${compact.slice(4)}${compact.slice(0, 4)}`)).toBe(1);

    const spaced = sweepIdentifiers("c/c IBAN IT60 X 05428 11101 0000001XXXXX");

    expect(spaced).toMatch(/^c\/c IBAN IT\d{2} [A-Z] \d{5} \d{5} \d{12}$/);
  });

  it("replaces a VAT number with a valid one, keeping an IT prefix", () => {
    const out = sweepIdentifiers("P.IVA 00743110157");

    expect(out).toMatch(/^P\.IVA \d{11}$/);
    expect(out).not.toBe("P.IVA 00743110157");
    expect(sweepIdentifiers("IT00743110157")).toMatch(/^IT\d{11}$/);
  });

  it("replaces an e-mail with one on the reserved .example domain", () => {
    expect(sweepIdentifiers("scrivere a mario.zanin@example.com.")).toMatch(
      /^scrivere a [a-z]+\.[a-z]+@posta\.example\.$/,
    );
  });

  it("replaces the subscriber digits of a phone number, keeping its prefix and shape", () => {
    const mobile = sweepIdentifiers("Per urgenze, chiamare il 347-50918273.");

    expect(mobile).toMatch(/^Per urgenze, chiamare il 347-\d{8}\.$/);
    expect(mobile).not.toContain("50918273");
    expect(sweepIdentifiers("+39 0432 918273")).toMatch(/^\+39 0432 \d{6}$/);
  });

  it("redraws the digits of an insurance policy number", () => {
    const out = sweepIdentifiers("Scadenza polizza assicurativa n.6153 Lumen");

    expect(out).toMatch(/^Scadenza polizza assicurativa n\.\d{4} Lumen$/);
    expect(out).not.toContain("6153");
    expect(sweepIdentifiers("Polizza n° 5531")).toMatch(/^Polizza n° \d{4}$/);
    expect(sweepIdentifiers("Premio polizza fabbricato")).toBe(
      "Premio polizza fabbricato",
    );
  });

  it("replaces the digits of a bank account number after C/C", () => {
    const out = sweepIdentifiers("Banca - C/C 1234.56");

    expect(out).toMatch(/^Banca - C\/C \d{4}\.\d{2}$/);
    expect(out).not.toBe("Banca - C/C 1234.56");
  });

  it("lists each identifier with the fake that replaces it", () => {
    const text = "tel 347-50918273, P.IVA 00743110157, n. 395 123 456";
    const pairs = identifierReplacements(text);

    expect(
      pairs.map(([original]) => {
        return original;
      }),
    ).toEqual(["347-50918273", "00743110157"]);
    expect(
      pairs.reduce((t, [original, fake]) => {
        return t.replace(original, fake);
      }, text),
    ).toBe(sweepIdentifiers(text));
    expect(identifierReplacements("nessun numero")).toEqual([]);
  });

  it("leaves utility numbers, dates, invoice numbers and post codes alone", () => {
    for (const text of [
      "Spese luci utenza n. 395 123 456: aprile",
      "Rata 1 (20/01/2013), Rata 2 (20/02/2013)",
      "fattura n. 304836 del 12/11/2013",
      "33100",
      "2011-04-14 09:45:35",
      "300.000000",
      "0432.123456",
    ]) {
      expect(sweepIdentifiers(text)).toBe(text);
    }
  });
});

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
