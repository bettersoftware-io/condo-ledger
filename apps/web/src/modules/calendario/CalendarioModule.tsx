import { useState } from "react";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { MonthGrid } from "./MonthGrid";
import { DayPanel } from "./DayPanel";
import { EventDialog } from "./EventDialog";
import { MONTHS, shiftMonth } from "./monthGridHelpers";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import styles from "./CalendarioModule.module.css";

type Filter = "tutte" | "competenza";
const YEARS = ["2009", "2010", "2011", "2012", "2013"]; // fixture era

export function CalendarioModule() {
  const rt = useAppRuntime();
  const toast = useToast();
  const ym = rt.useCalendarMonth();
  const day = rt.useSelectedDay();
  const layers = rt.useCalendarLayers();
  const monthEvents = rt.useCalendarEvents();
  const allEvents = rt.useAllCalendarEvents();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [filter, setFilter] = useState<Filter>("tutte");
  const [eventId, setEventId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const stub = () => toast("Non disponibile nel prototipo");

  const events = filter === "competenza"
    ? monthEvents.filter((e) => e.periodId === periodId)
    : monthEvents;
  const selected = events.find((e) => e.id === eventId) ?? null;

  const setMonth = (next: string) => { rt.setCalendarMonth(next); setEventId(null); };
  const selectDay = (iso: string) => { rt.selectDay(iso); setEventId(null); };

  const [year = "2011", month = "04"] = ym.split("-");
  const actions = [
    { icon: "add", label: "Aggiungi scadenza", primary: true, onClick: () => setDialog("add") },
    { icon: "edit", label: "Modifica scadenza", disabled: !selected, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi scadenza", disabled: !selected,
      onClick: () => { if (selected) { rt.commands.removeCalendarEvent(selected.id); setEventId(null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub },
    { icon: "pdf", label: "PDF", onClick: stub },
  ];

  return (
    <SectionPanel
      title="Calendario" actions={actions} count={events.length} countNoun="scadenze nel mese"
      legend={<div>Le scadenze sono colorate per calendario; «Competenza» mostra solo quelle dell'esercizio selezionato nei Condomini.</div>}
      toolbarRight={
        <span className={styles.controls}>
          <button className={styles.navBtn} aria-label="Mese precedente"
            onClick={() => setMonth(shiftMonth(ym, -1))}>‹</button>
          <label>Mese{" "}
            <select aria-label="Mese" value={month} onChange={(e) => setMonth(`${year}-${e.target.value}`)}>
              {MONTHS.map((m, i) =>
                <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </label>
          <label>Anno{" "}
            <select aria-label="Anno" value={year} onChange={(e) => setMonth(`${e.target.value}-${month}`)}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className={styles.navBtn} aria-label="Mese successivo"
            onClick={() => setMonth(shiftMonth(ym, 1))}>›</button>
          <label>Mostra{" "}
            <select aria-label="Mostra" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="tutte">Tutte le scadenze</option>
              <option value="competenza">Competenza</option>
            </select>
          </label>
        </span>
      }
    >
      <div className={styles.layout}>
        <MonthGrid ym={ym} events={events} layers={layers} selectedDay={day} onSelectDay={selectDay} />
        <DayPanel day={day} events={events} layers={layers} selectedEventId={eventId} onSelectEvent={setEventId} />
      </div>
      <EventDialog
        open={dialog !== null} onOpenChange={(o) => { if (!o) setDialog(null); }}
        layers={layers} events={allEvents}
        editing={dialog === "edit" ? selected : null}
        defaultDate={day ?? `${ym}-01`}
      />
    </SectionPanel>
  );
}
