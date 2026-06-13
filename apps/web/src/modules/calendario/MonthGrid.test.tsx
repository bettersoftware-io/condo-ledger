import { render, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { MonthGrid } from "./MonthGrid";

const layers: CalendarLayer[] = [{ id: "lay-scad", name: "Scadenze", color: "#c0392b" }];
const events: CalendarEvent[] = [
  { id: "e1", date: "2011-04-16", description: "F24 Ritenute", layerId: "lay-scad", status: "new", priority: "high" },
];

const grid = (over: Partial<Parameters<typeof MonthGrid>[0]> = {}) =>
  render(<MonthGrid ym="2011-04" events={events} layers={layers} selectedDay={null}
    onSelectDay={() => {}} todayIso="2011-04-13" {...over} />);

test("renders 42 day cells and the weekday headers", () => {
  const { container, getByText } = grid();
  expect(container.querySelectorAll("[data-iso]")).toHaveLength(42);
  expect(getByText("Lunedì")).toBeInTheDocument();
  expect(getByText("Domenica")).toBeInTheDocument();
});

test("places the event chip in its day cell", () => {
  const { container } = grid();
  const cell = container.querySelector('[data-iso="2011-04-16"]') as HTMLElement;
  expect(within(cell).getByText("F24 Ritenute")).toBeInTheDocument();
});

test("clicking a day reports its ISO date", () => {
  const onSelectDay = vi.fn();
  const { container } = grid({ onSelectDay });
  fireEvent.click(container.querySelector('[data-iso="2011-04-21"]')!);
  expect(onSelectDay).toHaveBeenCalledWith("2011-04-21");
});

test("weekend, today, selected and outside cells get marker classes", () => {
  const { container } = grid({ selectedDay: "2011-04-21" });
  expect(container.querySelector('[data-iso="2011-04-02"]')!.className).toMatch(/weekend/);
  expect(container.querySelector('[data-iso="2011-04-13"]')!.className).toMatch(/today/);
  expect(container.querySelector('[data-iso="2011-04-21"]')!.className).toMatch(/selected/);
  expect(container.querySelector('[data-iso="2011-03-28"]')!.className).toMatch(/outside/);
});

test("more than three events collapse into a +N altre marker", () => {
  const many: CalendarEvent[] = ["a", "b", "c", "d"].map((s) => ({
    id: `e-${s}`, date: "2011-04-08", description: `Evento ${s}`,
    layerId: "lay-scad", status: "new", priority: "low",
  }));
  const { container } = grid({ events: many });
  const cell = container.querySelector('[data-iso="2011-04-08"]') as HTMLElement;
  expect(within(cell).getByText("+1 altre")).toBeInTheDocument();
  expect(within(cell).queryByText("Evento d")).not.toBeInTheDocument();
});
