import type { Building, LegacySeedData } from "@cl/domain";

/**
 * How many years, at most, the seed is moved forward: the latest seeded
 * period (Pozzetto 2013) then falls in 2026, so the app's books, installments
 * and deadlines sit around today rather than a decade back. A fixed number,
 * not one worked out from the clock, so the seed is the same on every run;
 * move it when the year turns and run the generator again.
 */
export const SEED_YEAR_SHIFT = 13;

/**
 * The seed with every date of the books moved forward: the dates of entries,
 * invoices, installments, units, parties, periods and buildings, and the
 * years written in their text (`of 13/01/2013`, `Electricity bill Jan-Feb
 * 2011`, `December '12`, the period named `2013`).
 *
 * Each building moves by its own number of years: the most, up to `atMost`,
 * that keep every year its periods span as long as it was. The books split a
 * year by its days, so a 365-day year landing on a leap year would change
 * every amount prorated by days (Saturno 2011 moves 12 years, to 2023, not 13
 * to 2024). A person's birth date and a building's construction date are
 * facts about them, not about the books, and stay. The checks against the
 * legacy dump read the projection before this step, so they compare the
 * dump's own dates.
 */
export function shiftLegacySeed(
  data: LegacySeedData,
  atMost: number,
): LegacySeedData {
  const byPeriod = new Map<string, number>();
  const buildings = data.buildings.map((building) => {
    const years = yearsFor(building, atMost);

    for (const period of building.periods) {
      byPeriod.set(period.id, years);
    }

    return shiftValue(building, "", years) as Building;
  });

  return Object.fromEntries(
    Object.entries(data).map(([collection, records]) => {
      if (collection === "buildings") {
        return [collection, buildings];
      }

      return [
        collection,
        (records as unknown[]).map((record) => {
          return shiftRecord(record, collection, byPeriod);
        }),
      ];
    }),
  ) as unknown as LegacySeedData;
}

/** The years a building moves: the most, up to `atMost`, that keep its periods' years as long. */
export function yearsFor(building: Building, atMost: number): number {
  const years = building.periods.flatMap((period) => {
    return yearsBetween(period.start, period.end);
  });

  for (let shift = atMost; shift > 0; shift--) {
    const kept = years.every((year) => {
      return isLeap(year) === isLeap(year + shift);
    });

    if (kept) {
      return shift;
    }
  }

  return 0;
}

/** Fields that hold an ISO date or stamp, `2013-01-10` or `2013-01-10T11:09:43`. */
const DATE_FIELDS = new Set([
  "at",
  "createdOn",
  "date",
  "dueDate",
  "end",
  "from",
  "modifiedOn",
  "start",
  "to",
]);

/** Fields whose words may name a year. */
const TEXT_FIELDS = new Set(["description", "name", "notes", "reason"]);

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

const SLASHED_DATE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;

const SHORT_YEAR = new RegExp(`\\b(${MONTHS}) '(\\d{2})\\b`, "g");

/** A year on its own: not part of a date, a number or a code. */
const BARE_YEAR = /(?<![\d/.-])(20[01]\d)(?![\d/.-])/g;

/**
 * A record of the books, moved with its period's building. A record that
 * belongs to no period moves nothing, and one of those that holds a date
 * stops the generator: nothing says how far it should move.
 */
function shiftRecord(
  record: unknown,
  collection: string,
  byPeriod: Map<string, number>,
): unknown {
  const periodId = periodIdOf(record);

  if (periodId === undefined) {
    if (holdsDate(record)) {
      throw new Error(
        `shiftLegacySeed: a record of ${collection} holds a date and belongs to no period`,
      );
    }

    return record;
  }

  const years = byPeriod.get(periodId);

  if (years === undefined) {
    throw new Error(
      `shiftLegacySeed: ${collection} names period ${periodId}, which no building holds`,
    );
  }

  return shiftValue(record, "", years);
}

function periodIdOf(record: unknown): string | undefined {
  if (typeof record !== "object" || record === null) {
    return undefined;
  }

  const periodId: unknown = Reflect.get(record, "periodId");

  return typeof periodId === "string" ? periodId : undefined;
}

function holdsDate(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(holdsDate);
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.entries(value).some(([key, inner]) => {
    return (
      (DATE_FIELDS.has(key) && typeof inner === "string") || holdsDate(inner)
    );
  });
}

function shiftValue(value: unknown, field: string, years: number): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => {
      return shiftValue(item, field, years);
    });
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => {
        return [key, shiftValue(inner, key, years)];
      }),
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  if (DATE_FIELDS.has(field)) {
    return shiftIsoDate(value, years);
  }

  return TEXT_FIELDS.has(field) ? shiftText(value, years) : value;
}

function shiftIsoDate(value: string, years: number): string {
  const match = ISO_DATE.exec(value);

  if (match === null) {
    throw new Error(`shiftLegacySeed: "${value}" is not an ISO date`);
  }

  const [, year = "", month = "", day = ""] = match;
  const shiftedYear = Number(year) + years;

  return `${String(shiftedYear)}-${month}-${shiftedDay(shiftedYear, month, day)}${value.slice(10)}`;
}

function shiftText(value: string, years: number): string {
  return value
    .replace(SLASHED_DATE, (_, day: string, month: string, year: string) => {
      const shiftedYear = Number(year) + years;

      return `${shiftedDay(shiftedYear, month, day)}/${month}/${String(shiftedYear)}`;
    })
    .replace(SHORT_YEAR, (_, month: string, year: string) => {
      return `${month} '${String((Number(year) + years) % 100).padStart(2, "0")}`;
    })
    .replace(BARE_YEAR, (year: string) => {
      return String(Number(year) + years);
    });
}

function yearsBetween(start: string, end: string): number[] {
  const first = Number(start.slice(0, 4));
  const last = Number(end.slice(0, 4));

  return Array.from({ length: last - first + 1 }, (_, index) => {
    return first + index;
  });
}

/** The day, or the 28th where 29 February falls in a year with no such day. */
function shiftedDay(year: number, month: string, day: string): string {
  return month === "02" && day === "29" && !isLeap(year) ? "28" : day;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
