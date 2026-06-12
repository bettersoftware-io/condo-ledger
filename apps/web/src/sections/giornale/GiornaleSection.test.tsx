import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { GiornaleSection } from "./GiornaleSection";

function Inner() {
  const rt = useAppRuntime();
  const addMany = () => {
    for (let i = 0; i < 12; i++) {
      rt.commands.addTransaction("sat-2011", {
        date: "2011-08-01", description: `Movimento ${i + 1}`,
        entries: [
          { accountId: "cassa", label: "Cassa Contanti", dareCents: 100, avereCents: 0 },
          { accountId: "banca", label: "Banca", dareCents: 0, avereCents: 100 },
        ],
      });
    }
  };
  return (
    <>
      <button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button>
      <button onClick={addMany}>seed</button>
      <GiornaleSection />
    </>
  );
}
const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("shows transactions with entries as expandable child rows and the Partita column", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  expect(screen.getByText("Partita")).toBeInTheDocument();        // column header
  expect(screen.getByText("Acme Pulizie")).toBeInTheDocument();   // partita value
  expect(screen.getByText("Fornitori c/acquisti")).toBeInTheDocument(); // entry child row (expanded by default)
});

test("pages the journal 10 per page", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByText("seed")); // 3 fixtures + 12 = 15 txns
  expect(await screen.findByText("pagina 1 di 2")).toBeInTheDocument();
  expect(screen.queryByText("Movimento 12")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Pagina successiva"));
  expect(await screen.findByText("Movimento 12")).toBeInTheDocument();
});

test("Stampa is an honest stub toast", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Stampa"));
  expect(await screen.findByRole("status")).toHaveTextContent("Non disponibile nel prototipo");
});
