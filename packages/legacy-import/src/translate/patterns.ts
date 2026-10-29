import { exactEnglish } from "./exact.ts";

/**
 * A templated legacy string: the whole string matches `pattern`, and
 * `english` builds its English from the captures, or answers undefined when
 * a capture that must be translated (an invoice's reason) has no exact entry.
 * Names, numbers and dates in the captures are carried over as they are.
 */
interface Pattern {
  pattern: RegExp;
  english: (captures: readonly string[]) => string | undefined;
}

const DATE = String.raw`\d{2}/\d{2}/\d{4}`;
const INSTALLMENT = String.raw`Rata \d+ \(${DATE}\)`;

export const PATTERNS: readonly Pattern[] = [
  // "Registrazione fattura Natisone Gas S.p.A. n. 7736 del 13/01/2013: spese gas dicembre '09"
  {
    pattern: new RegExp(
      String.raw`^Registrazione fattura (.+?) n\. (\S+) del (${DATE}): (.+)$`,
    ),
    english: ([firm, number, date, reason]) => {
      return withReason(reason, (english) => {
        return `Invoice ${firm} no. ${number} of ${date}: ${english}`;
      });
    },
  },
  // "Registrazione fattura n. 43117 del 13/03/2013 (Energie del Ledra S.p.A. / Spese luci …)"
  {
    pattern: new RegExp(
      String.raw`^Registrazione fattura n\. (\S+) del (${DATE}) \((.+?) / (.+)\)$`,
    ),
    english: ([number, date, firm, reason]) => {
      return withReason(reason, (english) => {
        return `Invoice no. ${number} of ${date} (${firm} / ${english})`;
      });
    },
  },
  // "Pagamento fattura Adami Valerio n. 74 effettuato il 03/05/2013: Spese di amministrazione condominiale"
  {
    pattern: new RegExp(
      String.raw`^Pagamento fattura (.+?) n\. (\S+) effettuato il (${DATE}): (.+)$`,
    ),
    english: ([firm, number, date, reason]) => {
      return withReason(reason, (english) => {
        return `Payment of invoice ${firm} no. ${number} on ${date}: ${english}`;
      });
    },
  },
  // "Pagamento fattura Cragno Giardinaggio soc. coop. n. 42 del 23/04/2011: Taglio siepe giardino"
  {
    pattern: new RegExp(
      String.raw`^Pagamento fattura (.+?) n\. (\S+) del (${DATE}): (.+)$`,
    ),
    english: ([firm, number, date, reason]) => {
      return withReason(reason, (english) => {
        return `Payment of invoice ${firm} no. ${number} of ${date}: ${english}`;
      });
    },
  },
  // "Incasso Rate da Variola Dina: Rata 3 (20/03/2013), Rata 4 (20/04/2013)", and "Incasso Parziale Rate da …":
  // worded as the app's own collection wizard words a collection
  {
    pattern: new RegExp(
      `^Incasso (Parziale )?Rate da (.+?): (${INSTALLMENT}(?:, ${INSTALLMENT})*)$`,
    ),
    english: ([partial, payer, installments = ""]) => {
      return `${partial === undefined ? "Collection" : "Partial collection"} of installments from ${payer}: ${installments.replaceAll(/Rata (\d+)/g, "Installment $1")}`;
    },
  },
  // "Incasso Rate 2011 (Ordinario) / Minisini Ilaria"
  {
    pattern: /^Incasso Rate (\d{4}) \(Ordinario\) \/ (.+)$/,
    english: ([year, payer]) => {
      return `Installment collection ${year} (Ordinary) / ${payer}`;
    },
  },
  // "Incasso rate 2011 (Ordinario) n.1 del (Sarcinelli Albino)"
  {
    pattern: /^Incasso rate (\d{4}) \(Ordinario\) n\.(\d+) del \((.+)\)$/,
    english: ([year, number, payer]) => {
      return `Installment collection ${year} (Ordinary) no. ${number} (${payer})`;
    },
  },
  // "Rata nr. 1", "Rata 12": the name the app gives a new installment
  {
    pattern: /^Rata (?:nr\. )?(\d+)$/,
    english: ([number]) => {
      return `Installment ${number}`;
    },
  },
  // "Credito Carnico - C/C 4990808838": the bank's name and the account's number stay
  {
    pattern: /^(.+) - [Cc]\/[Cc] (.+)$/,
    english: ([bank, number]) => {
      return `${bank} - a/c ${number}`;
    },
  },
];

/** The English of a captured reason through the exact map, handed to `render`; undefined when the map has none. */
function withReason(
  reason: string | undefined,
  render: (english: string) => string,
): string | undefined {
  const english = reason === undefined ? undefined : exactEnglish(reason);

  return english === undefined ? undefined : render(english);
}
