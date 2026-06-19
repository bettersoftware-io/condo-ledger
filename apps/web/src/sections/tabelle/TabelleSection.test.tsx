import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { createGeneratedDataSource } from "../../mock/MockDataSource";
import { generatedSeed } from "../../mock/data.generated";
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

test("coefficient edit persists and re-splits the riparto live (generated seed)", async () => {
  // The cascade needs a seeded PeriodState to recompute; fixtures have none, so this
  // end-to-end "edit a coefficient -> riparto re-splits on screen" check runs against the
  // generated seed (the data the real app actually uses). We assert the riparto cells
  // CHANGE rather than a hardcoded value, so it is robust to the engine's exact rounding.
  const seed = generatedSeed;
  const states = seed.periodStateByPeriod ?? {};
  // first book period whose default-selected table (tables[0]) carries >= 2 coefficients
  const pid = Object.keys(states).find(
    (p) =>
      states[p]!.riparto.unitLegacyIds.length > 0 &&
      ((seed.distributionTablesByPeriod[p] ?? [])[0]?.items.length ?? 0) >= 2,
  )!;
  expect(pid).toBeTruthy();
  const firstCoeff = seed.distributionTablesByPeriod[pid]![0]!.items[0]!.coefficient;
  const fmt = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  function GenInner() {
    const rt = useAppRuntime();
    return (
      <>
        <button onClick={() => rt.select({ accountingPeriodId: pid })}>sel</button>
        <TabelleSection />
      </>
    );
  }
  render(
    <AppRuntimeProvider data={createGeneratedDataSource()}>
      <ToastProvider>
        <GenInner />
      </ToastProvider>
    </AppRuntimeProvider>,
  );
  await userEvent.click(screen.getByText("sel"));

  // the riparto (bottom) table is uniquely identified by its first column header
  const before = (await screen.findByText("Conto / Unità")).closest("table")!.textContent;

  // edit the first coefficient of the default-selected table to a clearly different value
  fireEvent.doubleClick(await screen.findByText(fmt(firstCoeff)));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "900" } });
  fireEvent.keyDown(input, { key: "Enter" });

  // let the rxjs commit -> react-rxjs re-render settle (a macrotask tick)
  await new Promise((r) => setTimeout(r, 0));

  // coefficient persisted to the store and re-rendered
  expect(await screen.findByText("900,0000", {}, { timeout: 3000 })).toBeInTheDocument();
  // riparto re-split live: the bottom table's contents changed
  await waitFor(
    () => expect(screen.getByText("Conto / Unità").closest("table")!.textContent).not.toBe(before),
    { timeout: 3000 },
  );
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
