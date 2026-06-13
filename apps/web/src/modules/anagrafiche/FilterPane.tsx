import type { AnagraficaKindFilter, AnagraficaStatusFilter } from "@cl/application";
import { SearchBox } from "../../components/common/SearchBox";
import styles from "./FilterPane.module.css";

/** Legacy MasterDataFilter + MasterDataCategories sidebar. Presentational:
 * filter state lives in the runtime slice; this pane only renders and forwards. */
export function FilterPane({
  search, onSearch, kind, onKind, stato, onStato, category, onCategory, categories, counts,
}: {
  search: string; onSearch: (q: string) => void;
  kind: AnagraficaKindFilter; onKind: (k: AnagraficaKindFilter) => void;
  stato: AnagraficaStatusFilter; onStato: (s: AnagraficaStatusFilter) => void;
  category: string | null; onCategory: (c: string | null) => void;
  categories: string[]; counts: Record<string, number>;
}) {
  return (
    <aside className={styles.pane}>
      <div className={styles.paneTitle}>Filtro Anagrafiche</div>
      <div className={styles.fields}>
        <label className={styles.field}>Parola chiave
          <SearchBox value={search} onChange={onSearch} placeholder="Cerca…" />
        </label>
        <label className={styles.field}>Tipo
          <select aria-label="Tipo" value={kind}
            onChange={(e) => onKind(e.target.value as AnagraficaKindFilter)}>
            <option value="tutte">Tutte</option>
            <option value="person">Persone fisiche</option>
            <option value="company">Società</option>
          </select>
        </label>
        <label className={styles.field}>Stato
          <select aria-label="Stato" value={stato}
            onChange={(e) => onStato(e.target.value as AnagraficaStatusFilter)}>
            <option value="tutte">Tutte</option>
            <option value="active">Attive</option>
            <option value="archived">Archiviate</option>
          </select>
        </label>
      </div>
      <div className={styles.paneTitle}>Categorie Anagrafiche</div>
      <ul className={styles.catList}>
        {categories.map((c) => (
          <li key={c}>
            <button
              className={`${styles.cat} ${category === c ? styles.catActive : ""}`}
              aria-pressed={category === c}
              onClick={() => onCategory(category === c ? null : c)}>
              {c} ({counts[c] ?? 0})
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
