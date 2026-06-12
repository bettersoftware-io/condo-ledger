import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { ContiSection } from "./ContiSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><ContiSection /></>;
}

test("shows chart of accounts and account detail", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Patrimoniali")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Cassa Contanti"));
  expect(await screen.findByText("Saldi conto")).toBeInTheDocument();
});

test("mastrino tab lists the selected account's movements with running saldo", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("Pulizie"));
  await userEvent.click(screen.getByText("Mastrino"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  expect(screen.getByText("R/d")).toBeInTheDocument();           // new column
  expect(screen.getByText("Proprietà")).toBeInTheDocument();     // Tabelle di riparto value
});

test("search narrows the tree and hide-empty drops zero accounts", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.type(await screen.findByPlaceholderText("Cerca conto…"), "banca");
  expect(screen.queryByText("Cassa Contanti")).not.toBeInTheDocument();
  expect(screen.getByText(/Banca Pop\. Emilia Romagna/)).toBeInTheDocument();
  await userEvent.clear(screen.getByPlaceholderText("Cerca conto…"));
  await userEvent.click(screen.getByLabelText("Nascondi conti vuoti"));
  expect(screen.queryByText("Erario c/ritenute")).not.toBeInTheDocument();
});

test("preventivo is inline-editable on expense accounts and persists to the store", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  // "1.200,00" appears in multiple cells: MoneyText renders <span class="cell positive">
  // while InlineMoney renders a plain <span> (no class). We target the last match because
  // the preventivo column is rightmost and thus last in DOM order within the row.
  //
  // Note on event strategy: userEvent.dblClick fires two full pointer+click sequences
  // before the dblclick event; the <tr onClick> handler fires on each click, causing
  // React to re-render and reset InlineMoney's local state before dblclick arrives.
  // fireEvent.doubleClick dispatches a single dblclick DOM event and correctly triggers
  // React's onDoubleClick. Similarly, userEvent.clear triggers blur (committing the empty
  // draft and hiding the input), so we use fireEvent.change + fireEvent.keyDown to update
  // the draft and commit via Enter without an intermediate blur.
  const cells = await screen.findAllByText("1.200,00");
  fireEvent.doubleClick(cells[cells.length - 1]!);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "1.300,00" } });
  fireEvent.keyDown(input, { key: "Enter" });
  // react-rxjs emits the store update asynchronously. Use waitFor to poll until the
  // value stabilises; avoids a stale-reference issue where findByText returns an element
  // that is then replaced by a re-render before toBeInTheDocument() can check it.
  await screen.findByText("1.300,00", {}, { timeout: 3000 });
  expect(screen.queryByText("1.300,00")).toBeInTheDocument();
});

test("adds an account via the dialog under a chosen group", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Nome conto"), "C/C Postale");
  await userEvent.selectOptions(screen.getByLabelText("Raggruppamento padre"), "liq");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("C/C Postale")).toBeInTheDocument();
});

test("adding the same account label twice produces two distinct rows without breaking the grid", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));

  // Add "Conto Doppio" the first time
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Nome conto"), "Conto Doppio");
  await userEvent.selectOptions(screen.getByLabelText("Raggruppamento padre"), "liq");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Conto Doppio")).toBeInTheDocument();

  // Add "Conto Doppio" a second time
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Nome conto"), "Conto Doppio");
  await userEvent.selectOptions(screen.getByLabelText("Raggruppamento padre"), "liq");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));

  // Both rows must be present — findAllByText returns them; if ids collided one would be replaced
  const matches = await screen.findAllByText("Conto Doppio");
  expect(matches).toHaveLength(2);
});

test("Rimuovi is disabled when the selected account is mapped as a functional account", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  // "forn" (Fornitori c/acquisti) is mapped as payable in the sat-2011 fixtures
  await userEvent.click(await screen.findByText("Fornitori c/acquisti"));
  expect(screen.getByLabelText("Rimuovi")).toBeDisabled();
});

test("functional accounts dialog persists role changes", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Conti funzionali"));
  await userEvent.selectOptions(screen.getByLabelText("Conto di liquidità"), "cassa");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  // reopen: the persisted value is shown
  await userEvent.click(screen.getByLabelText("Conti funzionali"));
  expect(screen.getByLabelText("Conto di liquidità")).toHaveValue("cassa");
});
