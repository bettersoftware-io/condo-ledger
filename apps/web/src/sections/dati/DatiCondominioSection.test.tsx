import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { DatiCondominioSection } from "./DatiCondominioSection";

function Harness() {
  return (
    <AppRuntimeProvider>
      <ToastProvider>
        <Inner />
      </ToastProvider>
    </AppRuntimeProvider>
  );
}
import { useAppRuntime } from "../../runtime/useAppRuntime";
function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>sel</button>
      <DatiCondominioSection />
    </>
  );
}

test("lists condominiums and shows detail after selection", async () => {
  render(<Harness />);
  expect(screen.getByText(/SAT — Saturno/)).toBeInTheDocument();
  expect(screen.getByText("2 condomini")).toBeInTheDocument();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Saturno")).toBeInTheDocument(); // intestazione in detail
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  expect(await screen.findByText(/Banca Pop\. Emilia Romagna/)).toBeInTheDocument();
});

test("period rows show the six money aggregates", async () => {
  render(<Harness />);
  expect(await screen.findByText("Liquidità")).toBeInTheDocument();
  expect(screen.getByText("518,41")).toBeInTheDocument();    // sat-2011 liquidità
  expect(screen.getByText("38.000,00")).toBeInTheDocument(); // sat-2011 preventivo
});

test("adds a condominium and a supplier; toggles an F24", async () => {
  render(<Harness />);
  await userEvent.click(screen.getByText("sel"));
  // add condominium
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Codice"), "NEW");
  await userEvent.type(screen.getByLabelText("Intestazione (con indirizzo)"), "Nuovo Condominio");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText(/NEW — Nuovo Condominio/)).toBeInTheDocument();
  // add supplier from candidates
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  await userEvent.click(screen.getByLabelText("Aggiungi fornitore"));
  await userEvent.selectOptions(screen.getByLabelText("Anagrafica"), "cand-1");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText(/Idraulica Blu/)).toBeInTheDocument();
  // F24 tab — scope the toggle within the table row to avoid the pre-paid fixture row
  await userEvent.click(screen.getByText("F24"));
  expect(await screen.findByText("Ritenute d'acconto 1° trim.")).toBeInTheDocument();
  const row = screen.getByText("Ritenute d'acconto 1° trim.").closest("tr")!;
  await userEvent.click(within(row).getByRole("button", { name: "da pagare" }));
  expect(within(row).getByRole("button", { name: "pagato" })).toBeInTheDocument();
});

test("documenti tab lists public and private file names", async () => {
  render(<Harness />);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByText("Documenti"));
  expect(await screen.findByText("Regolamento condominiale.pdf")).toBeInTheDocument();
  expect(screen.getByText("Contratto pulizie Acme.pdf")).toBeInTheDocument();
});
