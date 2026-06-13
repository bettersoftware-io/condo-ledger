import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { EventDialog, uniqueEventId } from "./EventDialog";

const layers: CalendarLayer[] = [{ id: "lay-scad", name: "Scadenze", color: "#c0392b" }];

const renderDialog = (editing: CalendarEvent | null) => render(
  <AppRuntimeProvider><ToastProvider>
    <EventDialog open onOpenChange={() => {}} layers={layers} events={[]}
      editing={editing} defaultDate="2011-04-01" />
  </ToastProvider></AppRuntimeProvider>,
);

test("uniqueEventId slugs the description and suffixes duplicates", () => {
  expect(uniqueEventId("Revisione caldaia!", [])).toBe("ev-revisione-caldaia");
  const existing = [{ id: "ev-revisione-caldaia" }, { id: "ev-revisione-caldaia-2" }];
  expect(uniqueEventId("Revisione caldaia", existing)).toBe("ev-revisione-caldaia-3");
  expect(uniqueEventId("???", [])).toBe("ev-evento");
});

test("empty description blocks the save with an Italian message", async () => {
  renderDialog(null);
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire una descrizione")).toBeInTheDocument();
});

test("add mode seeds the default date", () => {
  renderDialog(null);
  expect(screen.getByLabelText("Data")).toHaveValue("2011-04-01");
});

test("edit mode seeds every field from the event", () => {
  renderDialog({
    id: "ev-x", date: "2011-04-21", time: "18:00", description: "Assemblea",
    layerId: "lay-scad", status: "new", priority: "critical", notes: "ODG",
  });
  expect(screen.getByLabelText("Descrizione")).toHaveValue("Assemblea");
  expect(screen.getByLabelText("Data")).toHaveValue("2011-04-21");
  expect(screen.getByLabelText("Ora")).toHaveValue("18:00");
  expect(screen.getByLabelText("Priorità")).toHaveValue("critical");
  expect(screen.getByLabelText("Note")).toHaveValue("ODG");
});

test("malformed time blocks the save", async () => {
  // jsdom fully sanitises type="time" inputs and will not hold an invalid value like "9:9"
  // in the DOM under any fireEvent/userEvent approach (React's controlled-input reconciliation
  // resets the DOM to "" before the onChange handler can read it).  Seed the state via the
  // editing prop instead: useEffect calls setTime(editing.time) which bypasses DOM sanitisation.
  renderDialog({ id: "ev-x", date: "2011-04-21", time: "9:9", description: "Prova",
    layerId: "lay-scad", status: "new", priority: "medium" });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Formato ora non valido (HH:mm)")).toBeInTheDocument();
});
