import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { formatItDate } from "../../recompute/dates";
import { STATUS_LABELS, PRIORITY_LABELS } from "./labels";
import styles from "./DayPanel.module.css";

export function DayPanel({ day, events, layers, selectedEventId, onSelectEvent }: {
  day: string | null;
  /** the visible month's events; the panel narrows to `day` itself */
  events: CalendarEvent[];
  layers: CalendarLayer[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  const dayEvents = events.filter((e) => e.date === day);
  const sel = events.find((e) => e.id === selectedEventId) ?? null;
  const layerName = (id: string) => layers.find((l) => l.id === id)?.name ?? "—";
  return (
    <div className={styles.panel}>
      <div className={styles.title}>
        {day ? `Elenco scadenze del ${formatItDate(day)}` : "Seleziona un giorno dal calendario"}
      </div>
      <table className={styles.list}>
        <thead>
          <tr><th>Ora</th><th>Descrizione</th><th>Stato</th><th>Priorità</th></tr>
        </thead>
        <tbody>
          {dayEvents.map((e) => (
            <tr key={e.id} className={e.id === selectedEventId ? styles.rowSelected : ""}
              onClick={() => onSelectEvent(e.id)}>
              <td>{e.time ?? "—"}</td>
              <td>{e.description}</td>
              <td>{STATUS_LABELS[e.status]}</td>
              <td>{PRIORITY_LABELS[e.priority]}</td>
            </tr>
          ))}
          {day && dayEvents.length === 0 &&
            <tr><td colSpan={4} className={styles.empty}>Nessuna scadenza.</td></tr>}
        </tbody>
      </table>
      <div className={styles.title}>Dettagli scadenza</div>
      {sel ? (
        <FormCard>
          <FieldGroup>
            <Field label="Descrizione" value={sel.description} />
            <Field label="Data" value={`${formatItDate(sel.date)}${sel.time ? ` ${sel.time}` : ""}`} />
            <Field label="Calendario" value={layerName(sel.layerId)} />
            <Field label="Stato" value={STATUS_LABELS[sel.status]} />
            <Field label="Priorità" value={PRIORITY_LABELS[sel.priority]} />
            <Field label="Note" value={sel.notes ?? "—"} />
          </FieldGroup>
        </FormCard>
      ) : (
        <p className={styles.empty}>Nessuna scadenza selezionata.</p>
      )}
    </div>
  );
}
