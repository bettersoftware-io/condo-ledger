type PeriodType = "ordinary" | "extra" | "auxiliary";

interface Period {
  id: string;
  name: string;
  type: PeriodType;
  start: string;
  end: string;
  closed: boolean;
}

/** A condominium with its accounting periods. */
export interface Building {
  id: string;
  name: string;
  periods: Period[];
}
