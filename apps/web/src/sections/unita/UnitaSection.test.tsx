import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { UnitaSection } from "./UnitaSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><UnitaSection /></>;
}

test("shows units after selection and opens detail", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("A01 - Alberi Dina (PR)")).toBeInTheDocument();
  await userEvent.click(screen.getByText("A01 - Alberi Dina (PR)"));
  expect(await screen.findByText("Dati identificativi")).toBeInTheDocument();
});

test("regroup selector reshapes the tree", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await screen.findByText("A01 - Alberi Dina (PR)");
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "condomino");
  expect(screen.queryByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).not.toBeInTheDocument(); // group row gone
  expect(screen.getAllByText(/Mauri Dina \(PR 100%\)/).length).toBeGreaterThan(0);   // resident at top
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "gruppo");
  expect(await screen.findByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).toBeInTheDocument();
});
