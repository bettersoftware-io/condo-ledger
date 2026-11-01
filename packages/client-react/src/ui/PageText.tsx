import type { ReactElement } from "react";

import { TESTIDS } from "./testids.ts";

import "./Paging.css";

/** "Page n of m", and after it the detail given ("· 113 contacts total"). */
export function PageText({
  page,
  pageCount,
  detail,
}: PageTextProps): ReactElement {
  return (
    <span className="page-text" data-testid={TESTIDS.pageText}>
      Page <b>{page}</b> of {pageCount}
      {detail === undefined ? null : ` · ${detail}`}
    </span>
  );
}

export interface PageTextProps {
  page: number;
  pageCount: number;
  detail?: string;
}
