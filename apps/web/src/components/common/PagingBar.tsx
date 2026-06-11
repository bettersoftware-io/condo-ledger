import styles from "./SmallControls.module.css";

export function PagingBar({ page, pageCount, onPage }: {
  page: number; pageCount: number; onPage: (p: number) => void;
}) {
  if (pageCount < 1) return null;
  const first = page <= 1, last = page >= pageCount;
  return (
    <div className={styles.paging}>
      <button className={styles.pageBtn} aria-label="Prima pagina" disabled={first} onClick={() => onPage(1)}>«</button>
      <button className={styles.pageBtn} aria-label="Pagina precedente" disabled={first} onClick={() => onPage(page - 1)}>‹</button>
      <span className={styles.pageInfo}>pagina {page} di {pageCount}</span>
      <button className={styles.pageBtn} aria-label="Pagina successiva" disabled={last} onClick={() => onPage(page + 1)}>›</button>
      <button className={styles.pageBtn} aria-label="Ultima pagina" disabled={last} onClick={() => onPage(pageCount)}>»</button>
    </div>
  );
}
