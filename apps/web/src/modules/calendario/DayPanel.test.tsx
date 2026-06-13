import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { DayPanel } from "./DayPanel";

const layers: CalendarLayer[] = [{ id: "lay-assem", name: "Assemblee", color: "#2e6da4" }];
const events: CalendarEvent[] = [
  { id: "e1", date: "2011-04-21", time: "18:00", description: "Assemblea ordinaria",
    layerId: "lay-assem", status: "new", priority: "critical", notes: "Approvazione bilancio." },
  { id: "e2", date: "2011-04-22", description: "Altro evento", layerId: "lay-assem", status: "closed", priority: "low" },
];

test("lists only the selected day's events with time, status and priority labels", () => {
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId={null} onSelectEvent={() => {}} />);
  expect(screen.getByText("Elenco scadenze del 21/04/2011")).toBeInTheDocument();
  expect(screen.getByText("18:00")).toBeInTheDocument();
  expect(screen.getByText("Assemblea ordinaria")).toBeInTheDocument();
  expect(screen.getByText("Nuova")).toBeInTheDocument();
  expect(screen.getByText("Critica")).toBeInTheDocument();
  expect(screen.queryByText("Altro evento")).not.toBeInTheDocument();
});

test("clicking a row selects the event", () => {
  const onSelectEvent = vi.fn();
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId={null} onSelectEvent={onSelectEvent} />);
  fireEvent.click(screen.getByText("Assemblea ordinaria"));
  expect(onSelectEvent).toHaveBeenCalledWith("e1");
});

test("details card shows layer name, date+time and notes of the selected event", () => {
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId="e1" onSelectEvent={() => {}} />);
  expect(screen.getByText("Assemblee")).toBeInTheDocument();          // layer resolved by name
  expect(screen.getByText("21/04/2011 18:00")).toBeInTheDocument();
  expect(screen.getByText("Approvazione bilancio.")).toBeInTheDocument();
});

test("without a selected day it prompts; without a selected event the card is a placeholder", () => {
  render(<DayPanel day={null} events={events} layers={layers} selectedEventId={null} onSelectEvent={() => {}} />);
  expect(screen.getByText("Seleziona un giorno dal calendario")).toBeInTheDocument();
  expect(screen.getByText("Nessuna scadenza selezionata.")).toBeInTheDocument();
});
