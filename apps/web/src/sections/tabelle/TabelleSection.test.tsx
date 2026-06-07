import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { TabelleSection } from "./TabelleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><TabelleSection /></>;
}

test("lists tables, toggles preventivo/consuntivo, edits coefficient", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Proprietà")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Consuntivo"));
  // edit a coefficient
  const cell = await screen.findByText("312,5000");
  await userEvent.dblClick(cell);
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "400{Enter}");
  expect(screen.getByText("400,0000")).toBeInTheDocument();
});
