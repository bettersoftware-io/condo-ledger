import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { AnagraficheModule } from "./AnagraficheModule";

const setup = () => render(
  <AppRuntimeProvider><ToastProvider><AnagraficheModule /></ToastProvider></AppRuntimeProvider>,
);

test("shows the registry paged at 10 rows, sorted by nominativo", async () => {
  setup();
  expect(await screen.findByText("Acme Pulizie S.r.l.")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 3")).toBeInTheDocument(); // 23 fixtures / 10
  expect(screen.queryByText("Verdi Giardini")).not.toBeInTheDocument(); // sorts last → page 3
  await userEvent.click(screen.getByLabelText("Ultima pagina"));
  expect(await screen.findByText("Verdi Giardini")).toBeInTheDocument();
});

test("search + categoria filter compose and reset paging (spec §6)", async () => {
  setup();
  await userEvent.click(screen.getByLabelText("Pagina successiva")); // move off page 1 first
  await userEvent.type(screen.getByRole("searchbox"), "clean");
  expect(await screen.findByText("Zanon Servizi di Pulizia s.n.c.")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 1")).toBeInTheDocument(); // filter change resets paging
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  await userEvent.clear(screen.getByRole("searchbox"));
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(await screen.findByText("Mutua Assicuratrice del Livenza")).toBeInTheDocument();
  expect(screen.getByText("Minisini Assicurazioni s.r.l.")).toBeInTheDocument();
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  // clicking the active category clears the filter
  await userEvent.click(screen.getByRole("button", { name: "Assicurazione (2)" }));
  expect(await screen.findByText("Acme Pulizie S.r.l.")).toBeInTheDocument();
});

test("tipo filter narrows to persone fisiche", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "person");
  expect(await screen.findByText("Alberi Dina")).toBeInTheDocument();
  expect(screen.getByText("pagina 1 di 1")).toBeInTheDocument(); // 6 persons fit one page
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
});

test("stato filter narrows to archived records", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Stato"), "archived");
  expect(await screen.findByText("Fella Gas S.p.A.")).toBeInTheDocument();
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
});

test("selecting a row fills the detail card and the condomini links tab", async () => {
  setup();
  await userEvent.click(await screen.findByText("Banca Pop. Emilia Romagna"));
  expect(await screen.findByText("DATI SOCIETÀ")).toBeInTheDocument();
  expect(screen.getByText("IT60X0542811101000000123456")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Anagrafiche Condomini" }));
  expect(await screen.findByText("Fornitore")).toBeInTheDocument();
  expect(screen.getByText("2011 (Ordinario)")).toBeInTheDocument();
});

test("add persona end-to-end: dialog → grid (spec §6)", async () => {
  setup();
  await userEvent.click(screen.getByLabelText("Aggiungi persona"));
  await userEvent.type(screen.getByLabelText("Cognome"), "Zorzi");
  await userEvent.type(screen.getByLabelText("Nome"), "Anna");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  await userEvent.type(screen.getByRole("searchbox"), "zorzi");
  expect(await screen.findByText("Zorzi Anna")).toBeInTheDocument();
});

test("ghost selection: filtering out the selected row disables Modifica/Rimuovi", async () => {
  setup();
  await userEvent.click(await screen.findByText("Acme Pulizie S.r.l."));
  expect(screen.getByLabelText("Modifica anagrafica")).toBeEnabled();
  await userEvent.type(screen.getByRole("searchbox"), "clean");
  expect(screen.getByLabelText("Modifica anagrafica")).toBeDisabled();
  expect(screen.getByLabelText("Rimuovi anagrafica")).toBeDisabled();
});

test("rimuovi deletes the selected row and clears the selection", async () => {
  setup();
  await userEvent.click(await screen.findByText("Acme Pulizie S.r.l."));
  await userEvent.click(screen.getByLabelText("Rimuovi anagrafica"));
  expect(screen.queryByText("Acme Pulizie S.r.l.")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Modifica anagrafica")).toBeDisabled();
});
