import { render, screen } from "@testing-library/react";
import { AnagraficaLinks } from "./AnagraficaLinks";

test("renders one row per link", () => {
  render(<AnagraficaLinks links={[
    { condominio: "Saturno", esercizio: "2011 (Ordinario)", ruolo: "Fornitore", dettaglio: "Istituto di credito" },
    { condominio: "Pozzetto", esercizio: "2010 (Ordinario)", ruolo: "Condòmino", dettaglio: "P01 - Floreani Tiziano" },
  ]} />);
  expect(screen.getByText("Condominio")).toBeInTheDocument();
  expect(screen.getByText("Fornitore")).toBeInTheDocument();
  expect(screen.getByText("P01 - Floreani Tiziano")).toBeInTheDocument();
});

test("renders the empty state when there are no links", () => {
  render(<AnagraficaLinks links={[]} />);
  expect(screen.getByText("Nessun collegamento ai condomini.")).toBeInTheDocument();
});
