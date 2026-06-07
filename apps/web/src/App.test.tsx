import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

test("end-to-end: pick period → navigate sections", async () => {
  render(<App />);
  // registry visible first (appears in sidebar + Dati grid)
  expect((await screen.findAllByText(/SAT — Saturno/)).length).toBeGreaterThan(0);
  // pick a period in the sidebar tree (first match = sidebar, which calls rt.select)
  await userEvent.click(screen.getAllByText("2011 (Ordinario)")[0]!);
  // navigate to Tabelle via the section menu
  await userEvent.click(screen.getByText("Tabelle Millesimali e Riparto"));
  expect(await screen.findByText("Proprietà")).toBeInTheDocument();
  // switch module to the Anagrafiche stub
  await userEvent.click(screen.getByText("Anagrafiche"));
  expect(await screen.findByText(/non incluso nel prototipo/)).toBeInTheDocument();
});
