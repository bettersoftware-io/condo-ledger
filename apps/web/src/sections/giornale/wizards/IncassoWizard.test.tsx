import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { GiornaleSection } from "../GiornaleSection";
import { UnitaSection } from "../../unita/UnitaSection";

function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button>
      <GiornaleSection />
      <UnitaSection />
    </>
  );
}

test("incasso settles a rata and bumps Versato in the Unità section", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Incasso"));

  await userEvent.type(screen.getByLabelText("Data"), "2011-10-01");
  await userEvent.selectOptions(screen.getByLabelText("Condòmino"), "r-a01-1");
  await userEvent.click(screen.getByText("Avanti"));

  await userEvent.click(screen.getByLabelText(/Rata 1 — 495,76/)); // A01 r1 = 49576 cents
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.click(screen.getByText("Avanti")); // liquid account defaults to functional "banca"
  await userEvent.click(screen.getByRole("button", { name: "Conferma" }));

  expect(await screen.findByText(/Incasso Alberi Dina/)).toBeInTheDocument(); // journal row
  const versati = await screen.findAllByText("495,76");
  expect(versati.length).toBeGreaterThanOrEqual(1); // Versato cell(s) in Unità
});
