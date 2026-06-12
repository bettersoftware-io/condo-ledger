import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { ContiSection } from "./ContiSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><ContiSection /></>;
}

test("shows chart of accounts and account detail", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Patrimoniali")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Cassa Contanti"));
  expect(await screen.findByText("Saldi conto")).toBeInTheDocument();
});

test("mastrino tab lists the selected account's movements with running saldo", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("Pulizie"));
  await userEvent.click(screen.getByText("Mastrino"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  expect(screen.getByText("R/d")).toBeInTheDocument();           // new column
  expect(screen.getByText("Proprietà")).toBeInTheDocument();     // Tabelle di riparto value
});

test("search narrows the tree and hide-empty drops zero accounts", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.type(await screen.findByPlaceholderText("Cerca conto…"), "banca");
  expect(screen.queryByText("Cassa Contanti")).not.toBeInTheDocument();
  expect(screen.getByText(/Banca Pop\. Emilia Romagna/)).toBeInTheDocument();
  await userEvent.clear(screen.getByPlaceholderText("Cerca conto…"));
  await userEvent.click(screen.getByLabelText("Nascondi conti vuoti"));
  expect(screen.queryByText("Erario c/ritenute")).not.toBeInTheDocument();
});

test("preventivo is inline-editable on expense accounts and persists to the store", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
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
