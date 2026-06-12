import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { Anagrafica } from "@cl/application";
import { AnagraficaDetails } from "./AnagraficaDetails";

const person: Anagrafica = {
  id: "ana-p", kind: "person", nominativo: "Alberi Dina", categoria: "Condòmino",
  stato: "active", nome: "Dina", cognome: "Alberi", sesso: "f",
  dataNascita: "1955-04-05", luogoNascita: "Udine",
  indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "LBRRTT55D45L483F",
};
const company: Anagrafica = {
  id: "ana-c", kind: "company", nominativo: "Banca Pop. Emilia Romagna",
  categoria: "Istituto di credito", stato: "active", partitaIva: "72415790327",
  banca: "BPER — Filiale di Udine", iban: "IT60X0542811101000000123456",
  note: "Tesoreria condominiale.",
};

test("person card shows the legacy person group with formatted birth date", () => {
  render(<AnagraficaDetails anagrafica={person} />);
  expect(screen.getByText("DATI PERSONA FISICA")).toBeInTheDocument();
  expect(screen.getByText("Cognome")).toBeInTheDocument();
  expect(screen.getByText("Alberi")).toBeInTheDocument();
  expect(screen.getByText("Femmina")).toBeInTheDocument();      // SESSO_LABELS
  expect(screen.getByText("05/04/1955")).toBeInTheDocument();   // formatItDate
  expect(screen.getByText("Categoria Anagrafica")).toBeInTheDocument();
  expect(screen.queryByText("COORDINATE BANCARIE")).not.toBeInTheDocument(); // no bank data
});

test("company card shows ragione sociale, bank group and notes", () => {
  render(<AnagraficaDetails anagrafica={company} />);
  expect(screen.getByText("DATI SOCIETÀ")).toBeInTheDocument();
  expect(screen.getByText("Ragione Sociale")).toBeInTheDocument();
  expect(screen.getByText("COORDINATE BANCARIE")).toBeInTheDocument();
  expect(screen.getByText("IT60X0542811101000000123456")).toBeInTheDocument();
  expect(screen.getByText("NOTE INTERNE")).toBeInTheDocument();
  expect(screen.getByText("Tesoreria condominiale.")).toBeInTheDocument();
});

test("renders the placeholder when nothing is selected", () => {
  render(<AnagraficaDetails anagrafica={null} />);
  expect(screen.getByText("Nessuna anagrafica selezionata.")).toBeInTheDocument();
});
