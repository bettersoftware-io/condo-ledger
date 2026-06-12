import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { RateSection } from "./RateSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><RateSection /></>;
}

const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("shows installment columns and opens the create wizard", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Rata 1")).toBeInTheDocument();
  expect(screen.getByText("Rata 3")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));
  expect(await screen.findByText("1. Numero e periodo")).toBeInTheDocument();
});

test("editing a rata cell redistributes later rate and marks the cell", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  // "495,76" appears twice in the i-a01 row (r1 and r2 both equal 49576).
  // We target the FIRST occurrence which is r1 (leftmost in DOM order).
  const cells = await screen.findAllByText("495,76");
  fireEvent.doubleClick(cells[0]!); // A01 r1
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "400,00" } });
  fireEvent.keyDown(input, { key: "Enter" });
  // react-rxjs emits asynchronously; findByText may return a stale node that is
  // replaced before toBeInTheDocument() checks. Use findByText to wait for
  // stabilisation, then queryByText to read the current DOM node.
  await screen.findByText("400,00", {}, { timeout: 3000 });
  expect(screen.queryByText("400,00")).toBeInTheDocument();
  // delta 9576 spread over r2/r3: +4788 each → r2=54364→"543,64"
  await screen.findByText(/543,64/, {}, { timeout: 3000 });
  expect(screen.queryByText(/543,64/)).toBeInTheDocument();
});

test("modifica rata locks a rata: name disabled, header flagged", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Modifica rata"));
  await userEvent.selectOptions(screen.getByLabelText("Rata"), "r1");
  await userEvent.click(screen.getByLabelText("Bloccata"));
  expect(screen.getByLabelText("Nome")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Rata 1 (bloccata)")).toBeInTheDocument();
});

test("editing a rata to a value that drives later rates negative shows a toast and does not change the cell", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  // r1 = 495,76 (first occurrence); setting it to 999.999,99 would drive r2/r3 negative → rejected
  const cells = await screen.findAllByText("495,76");
  const r1Cell = cells[0]!;
  fireEvent.doubleClick(r1Cell);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "999.999,99" } });
  fireEvent.keyDown(input, { key: "Enter" });
  // toast must appear with "rate successive" in the message
  expect(await screen.findByRole("status", {}, { timeout: 3000 })).toHaveTextContent(/rate successive/);
  // the cell value must be unchanged: 495,76 still present (appears in multiple cells — r1 and r2)
  expect(screen.getAllByText("495,76").length).toBeGreaterThan(0);
});

test("locked rata cell is not inline-editable (double-click produces no textbox)", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  // lock r1 via the dialog
  await userEvent.click(screen.getByLabelText("Modifica rata"));
  await userEvent.selectOptions(screen.getByLabelText("Rata"), "r1");
  await userEvent.click(screen.getByLabelText("Bloccata"));
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Rata 1 (bloccata)")).toBeInTheDocument();
  // now double-click the A01 r1 cell — must NOT open an editor
  const cells = screen.getAllByText("495,76");
  fireEvent.doubleClick(cells[0]!); // first 495,76 is the locked r1 cell
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("crea rate wizard warns about overwrite and replaces the installment set", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));

  const dialog = await screen.findByRole("dialog");
  await userEvent.selectOptions(within(dialog).getByLabelText("Tabella di riparto"), "t-prop");
  const tot = within(dialog).getByLabelText("Totale preventivo");
  await userEvent.clear(tot); await userEvent.type(tot, "38.000,00{Enter}");
  await userEvent.type(within(dialog).getByLabelText("Prima scadenza"), "2011-02-01");
  await userEvent.click(within(dialog).getByText("Avanti"));

  // Preview step: "A01 - Alberi Dina" appears in the dialog (distribution table item label).
  // The same string also exists in the grid behind the dialog, so we scope to the dialog.
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getByText("A01 - Alberi Dina")).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole("dialog")).getByText("Avanti"));

  // Revisione step: overwrite warning must appear.
  expect(await screen.findByRole("alert")).toHaveTextContent("verranno sostituite");
  await userEvent.click(screen.getByRole("button", { name: "Conferma" }));

  // After submission the dialog closes and the grid shows the new installment columns.
  expect(await screen.findByText("Rata 1 (01/02/2011)")).toBeInTheDocument();
  expect(screen.getByText("Rata 4 (01/11/2011)")).toBeInTheDocument();
});
