import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FilterPane } from "./FilterPane";

const noop = () => {};
const base = {
  search: "", onSearch: noop,
  kind: "tutte" as const, onKind: noop,
  stato: "tutte" as const, onStato: noop,
  category: null, onCategory: noop,
  categories: ["Assicurazione", "Idraulico"],
  counts: { Assicurazione: 2 },
};

test("renders search, tipo and stato selects and the category list with counts", () => {
  render(<FilterPane {...base} />);
  expect(screen.getByText("Filtro Anagrafiche")).toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toBeInTheDocument();
  expect(screen.getByLabelText("Tipo")).toBeInTheDocument();
  expect(screen.getByLabelText("Stato")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Assicurazione (2)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Idraulico (0)" })).toBeInTheDocument(); // missing count → 0
});

test("clicking a category selects it; clicking the active one clears", async () => {
  const onCategory = vi.fn();
  const { rerender } = render(<FilterPane {...base} onCategory={onCategory} />);
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(onCategory).toHaveBeenCalledWith("Assicurazione");
  rerender(<FilterPane {...base} category="Assicurazione" onCategory={onCategory} />);
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(onCategory).toHaveBeenLastCalledWith(null); // toggle off
});

test("tipo, stato and search forward changes", async () => {
  const onKind = vi.fn(); const onStato = vi.fn(); const onSearch = vi.fn();
  render(<FilterPane {...base} onKind={onKind} onStato={onStato} onSearch={onSearch} />);
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "person");
  expect(onKind).toHaveBeenCalledWith("person");
  await userEvent.selectOptions(screen.getByLabelText("Stato"), "archived");
  expect(onStato).toHaveBeenCalledWith("archived");
  await userEvent.type(screen.getByRole("searchbox"), "x");
  expect(onSearch).toHaveBeenCalledWith("x");
});
