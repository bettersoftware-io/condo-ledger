import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders shell with brand and nav", () => {
  render(<App />);
  expect(screen.getByText("CondoLedger")).toBeInTheDocument();
  // "Condomini" appears in the nav tab AND the breadcrumb — assert presence, not uniqueness
  expect(screen.getAllByText("Condomini").length).toBeGreaterThan(0);
});
