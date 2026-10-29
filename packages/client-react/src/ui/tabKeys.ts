/**
 * The tab a key moves to in a horizontal tab list, after WAI-ARIA's tabs:
 * ArrowRight and ArrowLeft step and wrap at the ends, Home and End go to the
 * first and the last. Null for a key that moves nothing.
 */
export function tabAfterKey(
  key: string,
  from: number,
  count: number,
): number | null {
  switch (key) {
    case "ArrowRight":
      return (from + 1) % count;
    case "ArrowLeft":
      return (from - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
