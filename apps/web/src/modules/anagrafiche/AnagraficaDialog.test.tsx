import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Anagrafica, AnagraficaKind } from "@cl/application";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { AnagraficaDialog, uniqueAnagraficaId } from "./AnagraficaDialog";

function Host({ kind, editingId }: { kind: AnagraficaKind; editingId?: string }) {
  const rt = useAppRuntime();
  const all = rt.useAllAnagrafiche();
  const categories = rt.useAnagraficaCategories();
  const [open, setOpen] = useState(true);
  return (
    <>
      <AnagraficaDialog open={open} onOpenChange={setOpen} kind={kind}
        editing={all.find((a) => a.id === editingId) ?? null}
        categories={categories} anagrafiche={all} />
      <div data-testid="all">{all.map((a) => `${a.id}:${a.nominativo}`).join("|")}</div>
    </>
  );
}
const setup = (props: { kind: AnagraficaKind; editingId?: string }) => render(
  <AppRuntimeProvider><ToastProvider><Host {...props} /></ToastProvider></AppRuntimeProvider>,
);

test("uniqueAnagraficaId slugs, strips accents, falls back and suffixes", () => {
  const existing = [{ id: "ana-rossi-mario" }, { id: "ana-rossi-mario-2" }] as Anagrafica[];
  expect(uniqueAnagraficaId("Società Nuova", [])).toBe("ana-societa-nuova");
  expect(uniqueAnagraficaId("", [])).toBe("ana-anagrafica");
  expect(uniqueAnagraficaId("Floreani Tiziano", existing)).toBe("ana-rossi-mario-3");
});

test("persona form requires the cognome", async () => {
  setup({ kind: "person" });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire il cognome")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument(); // veto: still open
});

test("azienda form requires the ragione sociale, then adds with a slug id", async () => {
  setup({ kind: "company" });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire la ragione sociale")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Ragione sociale"), "Officina Nuova S.r.l.");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(screen.getByTestId("all").textContent).toContain("ana-officina-nuova-s-r-l:Officina Nuova S.r.l.");
});

test("edit seeds the form from the record and recomputes the nominativo", async () => {
  setup({ kind: "person", editingId: "ana-rossi" });
  expect(screen.getByLabelText("Cognome")).toHaveValue("Rossi");
  await userEvent.clear(screen.getByLabelText("Nome"));
  await userEvent.type(screen.getByLabelText("Nome"), "Maria");
  await userEvent.type(screen.getByLabelText("Professione"), "Insegnante");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(screen.getByTestId("all").textContent).toContain("ana-rossi:Rossi Maria"); // id stable, name recomputed
});
