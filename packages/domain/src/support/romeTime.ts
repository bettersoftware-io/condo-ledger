// The legacy app showed, and the UI shows, Rome wall-clock time. A fixed zone,
// so a stamp never depends on the machine that writes or reads it.
const ROME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The moment as "YYYY-MM-DDTHH:mm:ss" on the Rome clock: the form the seed's entries carry. */
export function romeTime(date: Date): string {
  const parts = new Map(
    ROME.formatToParts(date).map((part) => {
      return [part.type, part.value];
    }),
  );

  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`;
}
