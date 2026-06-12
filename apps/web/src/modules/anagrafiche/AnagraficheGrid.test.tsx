import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Anagrafica } from "@cl/application";
import { AnagraficheGrid } from "./AnagraficheGrid";

const rows: Anagrafica[] = [
  { id: "ana-p", kind: "person", nominativo: "Floreani Tiziano", categoria: "Condòmino",
    stato: "active", codiceFiscale: "RSSMRA70A01H501X" },
  { id: "ana-c", kind: "company", nominativo: "Energie del Ledra S.p.A.", categoria: "Fornitura energia elettrica",
    stato: "archived", codice: "ENERGIE DEL LEDRA", partitaIva: "00811720580", indirizzo: "viale Regina Margherita, 137, Roma" },
];

test("renders one row per anagrafica with legacy columns and em-dash blanks", () => {
  render(<AnagraficheGrid rows={rows} selectedId={null} onSelect={() => {}} />);
  expect(screen.getByText("Nominativo / Ragione Sociale")).toBeInTheDocument();
  expect(screen.getByText("Floreani Tiziano")).toBeInTheDocument();
  expect(screen.getByText("RSSMRA70A01H501X")).toBeInTheDocument();
  expect(screen.getByText("Archiviata")).toBeInTheDocument();   // STATO_LABELS
  expect(screen.getByLabelText("Persona fisica")).toBeInTheDocument(); // tipo icon a11y
  expect(screen.getByLabelText("Società")).toBeInTheDocument();
  // person row: codice, indirizzo and partita IVA are blank → "—"
  const personRow = screen.getByText("Floreani Tiziano").closest("tr")!;
  expect(personRow).toHaveTextContent("—");
});

test("clicking a row selects it; the selected row is marked", async () => {
  const onSelect = vi.fn();
  render(<AnagraficheGrid rows={rows} selectedId="ana-c" onSelect={onSelect} />);
  await userEvent.click(screen.getByText("Floreani Tiziano"));
  expect(onSelect).toHaveBeenCalledWith("ana-p");
  expect(screen.getByText("Energie del Ledra S.p.A.").closest("tr")!.className).toContain("selected");
});

test("empty list renders the placeholder row", () => {
  render(<AnagraficheGrid rows={[]} selectedId={null} onSelect={() => {}} />);
  expect(screen.getByText("Nessuna anagrafica trovata.")).toBeInTheDocument();
});
