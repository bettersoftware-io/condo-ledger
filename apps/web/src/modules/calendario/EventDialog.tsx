import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, CalendarLayer, CalendarPriority, CalendarStatus } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import { STATUS_LABELS, PRIORITY_LABELS } from "./labels";

/** Deterministic unique id: slug of the description + -2/-3… suffix against existing ids. */
export function uniqueEventId(description: string, existing: { id: string }[]): string {
  const slug = "ev-" +
    (description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento");
  let id = slug;
  let n = 2;
  while (existing.some((e) => e.id === id)) id = `${slug}-${n++}`;
  return id;
}

export function EventDialog({ open, onOpenChange, layers, events, editing, defaultDate }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  /** calendar layers for the Calendario select */
  layers: CalendarLayer[];
  /** the FULL event list (rt.useAllCalendarEvents) — id-uniqueness pool; the month slice would miss cross-month collisions */
  events: CalendarEvent[];
  /** event being edited, or null to add */
  editing: CalendarEvent | null;
  /** seed date for new events (the selected day, or the 1st of the visible month) */
  defaultDate: string;
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const [descrizione, setDescrizione] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [layerId, setLayerId] = useState("");
  const [status, setStatus] = useState<CalendarStatus>("new");
  const [priority, setPriority] = useState<CalendarPriority>("medium");
  const [notes, setNotes] = useState("");

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDescrizione(editing?.description ?? "");
      setDate(editing?.date ?? defaultDate);
      setTime(editing?.time ?? "");
      setLayerId(editing?.layerId ?? layers[0]?.id ?? "");
      setStatus(editing?.status ?? "new");
      setPriority(editing?.priority ?? "medium");
      setNotes(editing?.notes ?? "");
    }
    wasOpen.current = open;
  }, [open, editing, defaultDate, layers]);

  const submit = (): boolean => {
    const patch = {
      description: descrizione.trim(), date, layerId, status, priority,
      time: time || undefined, notes: notes.trim() || undefined,
    };
    try {
      if (editing) rt.commands.editCalendarEvent(editing.id, patch); // periodId omitted → preserved
      else rt.commands.addCalendarEvent({ id: uniqueEventId(patch.description, events), ...patch });
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Operazione non riuscita");
      return false;
    }
  };

  return (
    <WizardDialog
      open={open} onOpenChange={onOpenChange}
      title={editing ? "Modifica scadenza" : "Aggiungi scadenza"} submitLabel="Salva"
      onSubmit={submit}
      steps={[{
        title: "Dettagli",
        validate: () => {
          if (!descrizione.trim()) return "Inserire una descrizione";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Inserire una data valida";
          if (time && !/^\d{2}:\d{2}$/.test(time)) return "Formato ora non valido (HH:mm)";
          return null;
        },
        content: (
          <>
            <TextField label="Descrizione" value={descrizione} onChange={setDescrizione} />
            <DateField label="Data" value={date} onChange={setDate} />
            <TextField label="Ora" value={time} onChange={setTime} type="time" />
            <SelectField label="Calendario" value={layerId} onChange={setLayerId}
              options={layers.map((l) => ({ value: l.id, label: l.name }))} />
            <SelectField label="Stato" value={status} onChange={(v) => setStatus(v as CalendarStatus)}
              options={(Object.keys(STATUS_LABELS) as CalendarStatus[])
                .map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
            <SelectField label="Priorità" value={priority} onChange={(v) => setPriority(v as CalendarPriority)}
              options={(Object.keys(PRIORITY_LABELS) as CalendarPriority[])
                .map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
            <TextField label="Note" value={notes} onChange={setNotes} />
          </>
        ),
      }]}
    />
  );
}
