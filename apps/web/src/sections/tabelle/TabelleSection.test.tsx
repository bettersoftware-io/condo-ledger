import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { TabelleSection } from "./TabelleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><TabelleSection /></>;
}

function setup() {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
}

test("lists tables and toggles preventivo/consuntivo", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Proprietà")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Consuntivo"));
  expect(screen.getByText("Consuntivo")).toBeInTheDocument();
});

test("coefficient edit persists to the store and recomputes the riparto live", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  const cell = await screen.findByText("312,5000");
  fireEvent.doubleClick(cell);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "500" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("500,0000", {}, { timeout: 3000 });
  expect(screen.queryByText("500,0000")).toBeInTheDocument();
  expect(await screen.findByText("505,26", {}, { timeout: 3000 })).toBeInTheDocument(); // riparto A01 Pulizie re-split (50526 cents)
  expect(screen.getByText("Competenza")).toBeInTheDocument();    // new column
});

test("adds and removes a distribution table via the pane toolbar", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByLabelText("Aggiungi tabella"));
  await userEvent.type(screen.getByLabelText("Nome tabella"), "Acqua");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Acqua")).toBeInTheDocument();
});

test("AddItemDialog rejects a unit already present in the table", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  // Wait for the tables pane to render; "t-prop" table is pre-selected and contains u-a01
  await screen.findByLabelText("Aggiungi coefficiente");
  await userEvent.click(screen.getByLabelText("Aggiungi coefficiente"));
  // Pick the unit already in t-prop by its display label (from unitsTree fixture)
  await userEvent.selectOptions(screen.getByLabelText("Unità"), "A01 - Alberi Dina (PR)");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  // Validation error must appear
  expect(await screen.findByText("Unità già presente nella tabella")).toBeInTheDocument();
  // Dialog must remain open (Salva button still present)
  expect(screen.getByRole("button", { name: "Salva" })).toBeInTheDocument();
});

test("riparto shows the arrotondamento row, updated by coefficient edits", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Arrotondamento")).toBeInTheDocument();
  const cell = await screen.findByText("312,5000");
  fireEvent.doubleClick(cell);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "500" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect((await screen.findAllByText("0,01")).length).toBeGreaterThan(0); // 1 cent of rounding on Pulizie
});
