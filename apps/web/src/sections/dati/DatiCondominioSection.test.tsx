import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { DatiCondominioSection } from "./DatiCondominioSection";

function Harness() {
  return <AppRuntimeProvider><Inner /></AppRuntimeProvider>;
}
import { useAppRuntime } from "../../runtime/useAppRuntime";
function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>sel</button>
      <DatiCondominioSection />
    </>
  );
}

test("lists condominiums and shows detail after selection", async () => {
  render(<Harness />);
  expect(screen.getByText(/SAT — Saturno/)).toBeInTheDocument();
  expect(screen.getByText("2 condomini")).toBeInTheDocument();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Saturno")).toBeInTheDocument(); // intestazione in detail
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  expect(screen.getByText("Banca Pop. Emilia Romagna")).toBeInTheDocument();
});
