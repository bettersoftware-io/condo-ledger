import type { ReactElement } from "react";

import {
  type AllocationTableRow,
  type AmountLocale,
  hundredthsText,
} from "@cl/client-core";

import { useLocale } from "../amountLocale.ts";
import { TESTIDS } from "../testids.ts";

import "./AllocationTablesGrid.css";

/**
 * The ALLOCATION TABLES mini-grid of Account Details (README "Account
 * Details"): one row per link, its share of the account, its table, each
 * role priority's percentage, and the group the table is restricted to,
 * which no data sets yet. A blank cell reads "-". Read-only. Takes only
 * props and the locale, so the compiler memoizes it.
 */
export function AllocationTablesGrid({
  rows,
}: AllocationTablesGridProps): ReactElement {
  const locale = useLocale();

  return (
    <div className="account-tables-scroll">
      <div
        className="account-tables"
        data-testid={TESTIDS.allocationTablesGrid}
      >
        <div
          className="account-tables-head"
          data-testid={TESTIDS.allocationTablesHead}
        >
          <span>%</span>
          <span>Table</span>
          <span className="account-tables-share">PR/NP/LE</span>
          <span className="account-tables-share">US/CF</span>
          <span className="account-tables-share">CO</span>
          <span className="account-tables-share">SC</span>
          <span>Table restr. on group</span>
        </div>
        {rows.map((row) => {
          return (
            <div
              key={row.id}
              className="account-tables-row"
              data-testid={TESTIDS.allocationTablesRow}
            >
              <span className="account-tables-percentage">
                {percentText(row.percentage, locale)}
              </span>
              <span>{row.table}</span>
              <span className="account-tables-share">
                {percentText(row.roles[1], locale)}
              </span>
              <span className="account-tables-share">
                {percentText(row.roles[2], locale)}
              </span>
              <span className="account-tables-share">
                {percentText(row.roles[3], locale)}
              </span>
              <span className="account-tables-share">
                {percentText(row.roles[4], locale)}
              </span>
              <span className="account-tables-restriction">-None-</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface AllocationTablesGridProps {
  /** The links that apply to the account, own or inherited. */
  rows: AllocationTableRow[];
}

/** Hundredths of a percent as "50%" in the locale; a blank one as "-". */
function percentText(value: number | null, locale: AmountLocale): string {
  return value === null ? "-" : `${hundredthsText(value, locale)}%`;
}
