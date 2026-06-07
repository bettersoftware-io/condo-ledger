import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { TopBar } from "./TopBar";
import { MainNav } from "./MainNav";
import { Breadcrumb } from "./Breadcrumb";

test("topbar shows brand and logout", () => {
  render(<TopBar />);
  expect(screen.getByText("CondoLedger")).toBeInTheDocument();
  expect(screen.getByText("Esci")).toBeInTheDocument();
});
test("nav switches active module", async () => {
  render(<AppRuntimeProvider><MainNav /></AppRuntimeProvider>);
  const anagrafiche = screen.getByText("Anagrafiche");
  await userEvent.click(anagrafiche);
  expect(anagrafiche.closest("button")).toHaveClass("active");
});
test("breadcrumb marks last segment", () => {
  render(<Breadcrumb segments={["Condomini", "Saturno", "Dati"]} />);
  expect(screen.getByText("Dati")).toHaveClass("last");
});
