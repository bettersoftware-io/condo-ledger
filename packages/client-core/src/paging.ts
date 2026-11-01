export type PageSize = 10 | 25 | 50 | 100;

export const PAGE_SIZES: readonly PageSize[] = [10, 25, 50, 100];

/** How many pages `total` rows take at `size` a page: at least 1, so an empty list is still a page. */
export function pageCountOf(total: number, size: PageSize): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The page, from 1, that holds the row at `index`, from 0. */
export function pageOfIndex(index: number, size: PageSize): number {
  return Math.floor(index / size) + 1;
}

/** The page held within 1 to `pageCount`. */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), pageCount);
}
