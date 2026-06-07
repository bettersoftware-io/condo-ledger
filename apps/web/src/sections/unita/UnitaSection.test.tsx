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
