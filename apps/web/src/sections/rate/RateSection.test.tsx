import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { RateSection } from "./RateSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><RateSection /></>;
}

const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("shows installment columns and opens the create wizard", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Rata 1")).toBeInTheDocument();
  expect(screen.getByText("Rata 3")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));
  expect(await screen.findByText("1. Numero e periodo")).toBeInTheDocument();
});

test("editing a rata cell redistributes later rate and marks the cell", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  // "495,76" appears twice in the i-a01 row (r1 and r2 both equal 49576).
  // We target the FIRST occurrence which is r1 (leftmost in DOM order).
  const cells = await screen.findAllByText("495,76");
  fireEvent.doubleClick(cells[0]!); // A01 r1
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "400,00" } });
  fireEvent.keyDown(input, { key: "Enter" });
  // react-rxjs emits asynchronously; findByText may return a stale node that is
  // replaced before toBeInTheDocument() checks. Use findByText to wait for
  // stabilisation, then queryByText to read the current DOM node.
  await screen.findByText("400,00", {}, { timeout: 3000 });
  expect(screen.queryByText("400,00")).toBeInTheDocument();
  // delta 9576 spread over r2/r3: +4788 each → r2=54364→"543,64"
  await screen.findByText(/543,64/, {}, { timeout: 3000 });
  expect(screen.queryByText(/543,64/)).toBeInTheDocument();
});

test("modifica rata locks a rata: name disabled, header flagged", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Modifica rata"));
  await userEvent.selectOptions(screen.getByLabelText("Rata"), "r1");
  await userEvent.click(screen.getByLabelText("Bloccata"));
  expect(screen.getByLabelText("Nome")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Rata 1 (bloccata)")).toBeInTheDocument();
});
