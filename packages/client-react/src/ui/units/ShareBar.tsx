import { type ReactElement, useEffect, useRef } from "react";

import { useLocale } from "../amountLocale.ts";
import { formatShare } from "../format.ts";
import { TESTIDS } from "../testids.ts";

import "./ShareBar.css";

/**
 * A co-ownership share as a bar: a `--bd2` track, an `--acc` fill as wide as
 * the share, and the percentage over it, which is what assistive technology
 * reads. The fill's width is data the
 * stylesheet cannot know, so it is written as `--share-fill` in an effect, as
 * the tree grid writes its template.
 */
export function ShareBar({ share }: ShareBarProps): ReactElement {
  const bar = useRef<HTMLSpanElement>(null);
  const locale = useLocale();
  const percent = share / 10000;

  useEffect(() => {
    bar.current?.style.setProperty("--share-fill", `${percent}%`);
  }, [percent]);

  return (
    <span ref={bar} className="share-bar" data-testid={TESTIDS.shareBar}>
      <span className="share-bar-fill" aria-hidden="true" />
      <span className="share-bar-text">{formatShare(share, locale)}</span>
    </span>
  );
}

export interface ShareBarProps {
  /** In ten-thousandths of a percent: 1000000 is 100%. */
  share: number;
}
