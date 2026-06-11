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
