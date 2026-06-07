import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { RateSection } from "./RateSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><RateSection /></>;
}

test("shows installment columns and opens the create wizard", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Rata 1")).toBeInTheDocument();
  expect(screen.getByText("Rata 3")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));
  expect(await screen.findByText("1. Numero e periodo")).toBeInTheDocument();
});
