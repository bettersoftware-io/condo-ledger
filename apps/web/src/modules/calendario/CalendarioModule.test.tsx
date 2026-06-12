import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { CalendarioModule } from "./CalendarioModule";

function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>sel-sat</button>
      <CalendarioModule />
    </>
  );
}
const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("opens on the demo month with fixture chips and a count", async () => {
  setup();
  expect(await screen.findByText("Assemblea ordinaria — Condominio Saturno")).toBeInTheDocument();
  expect(screen.getByText(/5 scadenze nel mese/)).toBeInTheDocument();
});

test("month navigation refilters the grid", async () => {
  setup();
  await screen.findByText("Assemblea ordinaria — Condominio Saturno");
  await userEvent.click(screen.getByLabelText("Mese precedente"));
  expect(screen.queryByText("Assemblea ordinaria — Condominio Saturno")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Mese")).toHaveValue("03");
  await userEvent.selectOptions(screen.getByLabelText("Mese"), "08");
  expect(await screen.findByText("Chiusura studio per ferie")).toBeInTheDocument();
});

test("adding an event makes its chip appear in the month cell", async () => {
  const { container } = setup();
  await userEvent.click(screen.getByLabelText("Aggiungi scadenza"));
  await userEvent.type(screen.getByLabelText("Descrizione"), "Sopralluogo tetto");
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2011-04-09" } });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  const cell = container.querySelector('[data-iso="2011-04-09"]') as HTMLElement;
  expect(await within(cell).findByText("Sopralluogo tetto")).toBeInTheDocument();
});

test("competenza filter narrows the month to the selected period's events", async () => {
  setup();
  await screen.findByText("Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A."); // studio-wide event visible
  await userEvent.click(screen.getByText("sel-sat"));
  await userEvent.selectOptions(screen.getByLabelText("Mostra"), "competenza");
  expect(screen.queryByText("Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A.")).not.toBeInTheDocument();
  expect(screen.getByText("Assemblea ordinaria — Condominio Saturno")).toBeInTheDocument();
  expect(screen.getByText(/4 scadenze nel mese/)).toBeInTheDocument();
});

test("day click fills the list; row click fills the details and feeds Modifica", async () => {
  const { container } = setup();
  await screen.findByText("Assemblea ordinaria — Condominio Saturno");
  fireEvent.click(container.querySelector('[data-iso="2011-04-21"]')!);
  expect(await screen.findByText("Elenco scadenze del 21/04/2011")).toBeInTheDocument();
  fireEvent.click(screen.getByText("18:00"));                     // unique to the day-list row
  expect(screen.getByText("Assemblee")).toBeInTheDocument();      // details card layer name
  await userEvent.click(screen.getByLabelText("Modifica scadenza"));
  expect(screen.getByLabelText("Descrizione")).toHaveValue("Assemblea ordinaria — Condominio Saturno");
  await userEvent.clear(screen.getByLabelText("Descrizione"));
  await userEvent.type(screen.getByLabelText("Descrizione"), "Assemblea straordinaria");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  // appears both as a chip and as the day-list row → use findAllByText
  expect((await screen.findAllByText("Assemblea straordinaria")).length).toBeGreaterThan(0);
});

test("Rimuovi is disabled until an event is selected, then deletes it", async () => {
  const { container } = setup();
  await screen.findByText("Revisione caldaia — Condominio Saturno");
  expect(screen.getByLabelText("Rimuovi scadenza")).toBeDisabled();
  fireEvent.click(container.querySelector('[data-iso="2011-04-05"]')!);
  fireEvent.click(await screen.findByText("09:30"));
  await userEvent.click(screen.getByLabelText("Rimuovi scadenza"));
  expect(screen.queryByText("Revisione caldaia — Condominio Saturno")).not.toBeInTheDocument();
});
