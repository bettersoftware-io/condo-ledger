import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { Sidebar } from "./Sidebar";

function wrap() { return render(<AppRuntimeProvider><Sidebar /></AppRuntimeProvider>); }

test("section menu disabled until a period is selected", () => {
  wrap();
  expect(screen.getByText("Tabelle Millesimali e Riparto").closest("button")).toBeDisabled();
});
test("selecting a period enables the menu and selects it", async () => {
  wrap();
  await userEvent.click(screen.getByText("2011 (Ordinario)"));
  const tabelle = screen.getByText("Tabelle Millesimali e Riparto").closest("button")!;
  expect(tabelle).not.toBeDisabled();
  await userEvent.click(tabelle);
  expect(tabelle).toHaveClass("active");
});
