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

test("scrittura wizard validates balance and posts to the journal", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Scrittura"));

  // step 1
  await userEvent.type(screen.getByLabelText("Data"), "2011-09-01");
  await userEvent.type(screen.getByLabelText("Descrizione"), "Giroconto cassa-banca");
  await userEvent.click(screen.getByText("Avanti"));

  // step 2 — set both accounts first; then try unbalanced to get balance error
  // NOTE: validateEntries checks accounts before balance; with Conto 2 empty,
  // "Seleziona un conto per ogni riga" fires — not the balance message.
  // So we set both accounts first, then set only Dare 1 to get "non bilanciata".
  await userEvent.selectOptions(screen.getByLabelText("Conto 1"), "cassa");
  await userEvent.selectOptions(screen.getByLabelText("Conto 2"), "banca");

  // Enter an unbalanced amount — only Dare 1
  const dare1 = screen.getByLabelText("Dare 1");
  await userEvent.clear(dare1); await userEvent.type(dare1, "10,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));
  expect(await screen.findByText("Scrittura non bilanciata: dare ≠ avere")).toBeInTheDocument();

  // Fix by setting Avere 2 to match
  const avere2 = screen.getByLabelText("Avere 2");
  await userEvent.clear(avere2); await userEvent.type(avere2, "10,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));

  // step 3 — confirm
  await userEvent.click(screen.getByText("Conferma"));
  expect(await screen.findByText("Giroconto cassa-banca")).toBeInTheDocument(); // now in the grid
});
