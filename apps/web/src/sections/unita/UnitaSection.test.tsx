import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { UnitaSection } from "./UnitaSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><UnitaSection /></>;
}

function setup() {
  render(
    <AppRuntimeProvider>
      <ToastProvider>
        <Inner />
      </ToastProvider>
    </AppRuntimeProvider>,
  );
}

test("shows units after selection and opens detail", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("A01 - Alberi Dina (PR)")).toBeInTheDocument();
  await userEvent.click(screen.getByText("A01 - Alberi Dina (PR)"));
  expect(await screen.findByText("Dati identificativi")).toBeInTheDocument();
});

test("regroup selector reshapes the tree", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await screen.findByText("A01 - Alberi Dina (PR)");
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "condomino");
  expect(screen.queryByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).not.toBeInTheDocument(); // group row gone
  expect(screen.getAllByText(/Mauri Dina \(PR 100%\)/).length).toBeGreaterThan(0);   // resident at top
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "gruppo");
  expect(await screen.findByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).toBeInTheDocument();
});

test("adds a condòmino to the selected unit", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("A01 - Alberi Dina (PR)"));
  await userEvent.click(screen.getByLabelText("Aggiungi condòmino"));
  await userEvent.type(screen.getByLabelText("Nominativo"), "Verdi Anna");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Verdi Anna (PR 100%)")).toBeInTheDocument();
});

test("subentro end-dates the outgoing resident and adds the successor", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("A01 - Alberi Dina (PR)"));
  await userEvent.click(screen.getByLabelText("Subentro"));
  await userEvent.selectOptions(screen.getByLabelText("Condòmino uscente"), "r-a01-1");
  await userEvent.type(screen.getByLabelText("Data subentro"), "2011-07-01");
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.type(screen.getByLabelText("Nominativo subentrante"), "Bianchi Carlo");
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.click(screen.getByRole("button", { name: "Conferma" }));
  expect(await screen.findByText("Bianchi Carlo (PR 100%)")).toBeInTheDocument();
  expect(screen.getByText("fino al 01/07/2011")).toBeInTheDocument(); // outgoing restriction
});
