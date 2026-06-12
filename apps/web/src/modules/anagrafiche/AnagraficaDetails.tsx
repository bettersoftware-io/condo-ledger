import type { Anagrafica } from "@cl/application";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { formatItDate } from "../../recompute/dates";
import { KIND_LABELS, STATO_LABELS, SESSO_LABELS } from "./labels";
import styles from "./AnagraficaDetails.module.css";

/** Legacy "Dettagli Anagrafica" tab: person vs company field card. Read-only. */
export function AnagraficaDetails({ anagrafica: a }: { anagrafica: Anagrafica | null }) {
  if (!a) return <p className={styles.placeholder}>Nessuna anagrafica selezionata.</p>;
  return (
    <FormCard>
      {a.kind === "person" ? (
        <FieldGroup title="DATI PERSONA FISICA">
          <Field label="Nome" value={a.nome} />
          <Field label="Cognome" value={a.cognome} />
          <Field label="Sesso" value={a.sesso ? SESSO_LABELS[a.sesso] : undefined} />
          <Field label="Data di nascita" value={a.dataNascita ? formatItDate(a.dataNascita) : undefined} />
          <Field label="Luogo di nascita" value={a.luogoNascita} />
          <Field label="Professione" value={a.professione} />
        </FieldGroup>
      ) : (
        <FieldGroup title="DATI SOCIETÀ">
          <Field label="Ragione Sociale" value={a.nominativo} />
        </FieldGroup>
      )}
      <FieldGroup title="DATI UTILI">
        <Field label="Codice" value={a.codice} />
        <Field label="Status" value={STATO_LABELS[a.stato]} />
        <Field label="Tipologia anagrafica" value={KIND_LABELS[a.kind]} />
        <Field label="Categoria Anagrafica" value={a.categoria} />
        <Field label="Codice Fiscale" value={a.codiceFiscale} />
        <Field label="Partita IVA" value={a.partitaIva} />
        <Field label="Indirizzo di riferimento" value={a.indirizzo} />
      </FieldGroup>
      {(a.banca || a.iban) && (
        <FieldGroup title="COORDINATE BANCARIE">
          <Field label="Banca / Filiale" value={a.banca} />
          <Field label="IBAN" value={a.iban} />
        </FieldGroup>
      )}
      {a.note && (
        <FieldGroup title="NOTE INTERNE">
          <Field label="Note" value={a.note} />
        </FieldGroup>
      )}
    </FormCard>
  );
}
