import type { AnagraficaLink } from "@cl/application";
import styles from "./AnagraficaDetails.module.css";

/** Legacy "Anagrafiche Condomini" tab: read-only cross-references derived by the store. */
export function AnagraficaLinks({ links }: { links: AnagraficaLink[] }) {
  if (links.length === 0) {
    return <p className={styles.placeholder}>Nessun collegamento ai condomini.</p>;
  }
  return (
    <table className={styles.links}>
      <thead>
        <tr><th>Condominio</th><th>Esercizio</th><th>Ruolo</th><th>Dettaglio</th></tr>
      </thead>
      <tbody>
        {links.map((l, i) => (
          <tr key={i}>
            <td>{l.condominio}</td><td>{l.esercizio}</td><td>{l.ruolo}</td><td>{l.dettaglio}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
