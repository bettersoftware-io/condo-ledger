import { render, screen } from "@testing-library/react";
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
