import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { GiornaleSection } from "../GiornaleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><GiornaleSection /></>;
}

test("invoice wizard posts a balanced invoice into the journal", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Registra fattura"));

  // step 1: supplier, invoice number, date, gross amount
  await userEvent.selectOptions(screen.getByLabelText("Fornitore"), "s3");
  await userEvent.type(screen.getByLabelText("Numero fattura"), "F-99");
  await userEvent.type(screen.getByLabelText("Data"), "2011-09-15");
  const gross = screen.getByLabelText("Importo lordo");
  await userEvent.clear(gross); await userEvent.type(gross, "500,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));

  // step 2: withholding and expense account
  const rit = screen.getByLabelText("Ritenuta d'acconto");
  await userEvent.clear(rit); await userEvent.type(rit, "100,00{Enter}");
  await userEvent.selectOptions(screen.getByLabelText("Conto di spesa"), "e-pul");

  // Assert "Netto a pagare" while still on step 2 (it won't be rendered on step 3)
  expect(screen.getByText(/Netto a pagare/)).toBeInTheDocument();

  await userEvent.click(screen.getByText("Avanti"));

  // step 3: confirm — use getByRole to disambiguate from the step-strip title "Conferma"
  await userEvent.click(screen.getByRole("button", { name: "Conferma" }));
  expect(await screen.findByText(/Registrazione fattura F-99 Banca Pop\. Emilia Romagna/)).toBeInTheDocument();
});
