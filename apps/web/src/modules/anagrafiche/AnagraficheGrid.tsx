import type { Anagrafica, Id } from "@cl/application";
import { Icon } from "../../components/common/Icon";
import { KIND_LABELS, STATO_LABELS } from "./labels";
import styles from "./AnagraficheGrid.module.css";

const dash = (v?: string) => v ?? "—";

/** Legacy "Elenco Anagrafiche" grid. Flat (the registry is not a tree);
 * paging is the caller's concern — this renders exactly the rows it receives. */
export function AnagraficheGrid({ rows, selectedId, onSelect }: {
  rows: Anagrafica[]; selectedId: Id | null; onSelect: (id: Id) => void;
}) {
  return (
    <table className={styles.table} aria-label="Elenco Anagrafiche">
      <thead>
        <tr>
          <th>Nominativo / Ragione Sociale</th>
          <th>Codice</th>
          <th>Tipo</th>
          <th>Stato</th>
          <th>Indirizzo di riferimento</th>
          <th>Codice Fiscale</th>
          <th>Partita IVA</th>
          <th>Categoria</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={8} className={styles.empty}>Nessuna anagrafica trovata.</td></tr>
        )}
        {rows.map((a) => (
          <tr key={a.id}
            className={a.id === selectedId ? styles.selected : undefined}
            onClick={() => onSelect(a.id)}>
            <td className={styles.name}>{a.nominativo}</td>
            <td>{dash(a.codice)}</td>
            <td className={styles.tipo}>
              <span role="img" aria-label={KIND_LABELS[a.kind]}>
                <Icon name={a.kind === "person" ? "user" : "building"} size={14} />
              </span>
            </td>
            <td>{STATO_LABELS[a.stato]}</td>
            <td>{dash(a.indirizzo)}</td>
            <td>{dash(a.codiceFiscale)}</td>
            <td>{dash(a.partitaIva)}</td>
            <td>{a.categoria}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
