import { render, screen, act } from "@testing-library/react";
import { Suspense } from "react";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { useAppRuntime } from "./useAppRuntime";
import { createAppRuntime } from "./createAppRuntime";
import { createMockDataSource } from "../mock/MockDataSource";

function TreeProbe() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  return <div data-testid="count">{tree.length}</div>;
}
function SelectionProbe() {
  const rt = useAppRuntime();
  const sel = rt.useSelection();
  return (
    <div>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>pick</button>
      <span data-testid="sel">{sel.accountingPeriodId ?? "none"}</span>
    </div>
  );
}

test("provides condominium tree from mock", () => {
  render(
    <AppRuntimeProvider>
      <Suspense fallback="loading"><TreeProbe /></Suspense>
    </AppRuntimeProvider>,
  );
  expect(screen.getByTestId("count")).toHaveTextContent("2");
});

test("two providers do NOT share state (no singletons)", async () => {
  function App() {
    return (
      <>
        <AppRuntimeProvider><SelectionProbe /></AppRuntimeProvider>
        <AppRuntimeProvider><SelectionProbe /></AppRuntimeProvider>
      </>
    );
  }
  render(<App />);
  const [btnA] = screen.getAllByText("pick");
  await act(async () => { btnA!.click(); });
  const sels = screen.getAllByTestId("sel");
  expect(sels[0]).toHaveTextContent("sat-2011");
  expect(sels[1]).toHaveTextContent("none"); // second instance untouched
});

it("exposes store commands and per-section row selection", () => {
  const data = createMockDataSource();
  const rt = createAppRuntime({ data });
  expect(typeof rt.commands.addTransaction).toBe("function");

  function Probe() {
    const sel = rt.useSelectedRow("conti");
    return <span data-testid="sel">{sel ?? "none"}</span>;
  }
  render(<Probe />);
  expect(screen.getByTestId("sel").textContent).toBe("none");
  act(() => rt.selectRow("conti", "cassa"));
  expect(screen.getByTestId("sel").textContent).toBe("cassa");
});

function CalendarProbe() {
  const rt = useAppRuntime();
  const ym = rt.useCalendarMonth();
  const events = rt.useCalendarEvents();
  const all = rt.useAllCalendarEvents();
  const day = rt.useSelectedDay();
  return (
    <div>
      <button onClick={() => rt.selectDay("2011-04-21")}>day</button>
      <button onClick={() => rt.setCalendarMonth("2011-08")}>aug</button>
      <span data-testid="ym">{ym}</span>
      <span data-testid="n">{events.length}</span>
      <span data-testid="all">{all.length}</span>
      <span data-testid="first">{events[0]?.id ?? "none"}</span>
      <span data-testid="day">{day ?? "none"}</span>
    </div>
  );
}

test("calendar slice: demo month default, events filtered and date-sorted", () => {
  render(<AppRuntimeProvider><CalendarProbe /></AppRuntimeProvider>);
  expect(screen.getByTestId("ym")).toHaveTextContent("2011-04");
  expect(screen.getByTestId("n")).toHaveTextContent("5");
  expect(screen.getByTestId("all")).toHaveTextContent("13"); // full fixture list, unfiltered
  expect(screen.getByTestId("first")).toHaveTextContent("ev-cald-sat"); // 2011-04-05 sorts first
});

test("calendar slice: month change refilters and clears the selected day", async () => {
  render(<AppRuntimeProvider><CalendarProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("day").click(); });
  expect(screen.getByTestId("day")).toHaveTextContent("2011-04-21");
  await act(async () => { screen.getByText("aug").click(); });
  expect(screen.getByTestId("ym")).toHaveTextContent("2011-08");
  expect(screen.getByTestId("n")).toHaveTextContent("2"); // Rata 3 + ferie
  expect(screen.getByTestId("day")).toHaveTextContent("none");
});

function AnagraficheProbe() {
  const rt = useAppRuntime();
  const rows = rt.useAnagrafiche();
  const all = rt.useAllAnagrafiche();
  const counts = rt.useAnagraficaCategoryCounts();
  const links = rt.useAnagraficaLinks();
  const selected = rt.useSelectedAnagrafica();
  return (
    <div>
      <button onClick={() => rt.setAnagSearch("clean")}>search</button>
      <button onClick={() => rt.setAnagKind("person")}>persone</button>
      <button onClick={() => rt.setAnagStato("archived")}>archiviate</button>
      <button onClick={() => rt.setAnagCategory("Assicurazione")}>cat</button>
      <button onClick={() => rt.selectAnagrafica("ana-bper")}>pick</button>
      <span data-testid="n">{rows.length}</span>
      <span data-testid="all">{all.length}</span>
      <span data-testid="first">{rows[0]?.id ?? "none"}</span>
      <span data-testid="credito">{counts["Istituto di credito"] ?? 0}</span>
      <span data-testid="links">{links.map((l) => l.ruolo).join(",") || "none"}</span>
      <span data-testid="sel">{selected ?? "none"}</span>
    </div>
  );
}

test("anagrafiche slice: full registry by default, sorted by nominativo", () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  expect(screen.getByTestId("n").textContent).toBe("23");
  expect(screen.getByTestId("all").textContent).toBe("23");
  expect(screen.getByTestId("first")).toHaveTextContent("ana-acme"); // "Acme Pulizie S.r.l." sorts first
  expect(screen.getByTestId("credito").textContent).toBe("2"); // BPER + CariFVG
});

test("anagrafiche slice: search, tipo and categoria filters compose; counts stay unfiltered", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("search").click(); });
  expect(screen.getByTestId("n").textContent).toBe("1"); // Zanon Servizi di Pulizia only
  expect(screen.getByTestId("first")).toHaveTextContent("ana-friulclean");
  await act(async () => { screen.getByText("persone").click(); });
  expect(screen.getByTestId("n").textContent).toBe("0"); // "clean" matches no person
  expect(screen.getByTestId("credito").textContent).toBe("2"); // counts ignore filters
});

test("anagrafiche slice: stato filter narrows to archived records", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("archiviate").click(); });
  expect(screen.getByTestId("n").textContent).toBe("1"); // only AMGA is archived
  expect(screen.getByTestId("first")).toHaveTextContent("ana-amga");
});

test("anagrafiche slice: categoria filter and selected-anagrafica links", async () => {
  render(<AppRuntimeProvider><AnagraficheProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("cat").click(); });
  expect(screen.getByTestId("n").textContent).toBe("2"); // Lloyd + Reale Mutua
  expect(screen.getByTestId("links")).toHaveTextContent("none");
  await act(async () => { screen.getByText("pick").click(); });
  expect(screen.getByTestId("sel")).toHaveTextContent("ana-bper");
  expect(screen.getByTestId("links")).toHaveTextContent("Fornitore");
});
