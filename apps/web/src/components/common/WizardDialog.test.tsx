import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { WizardDialog } from "./WizardDialog";

const steps = [
  { title: "Dati", content: <p>passo uno</p>, validate: () => null },
  { title: "Conferma", content: <p>passo due</p> },
];

describe("WizardDialog", () => {
  it("navigates forward/back and submits on the last step", () => {
    const onSubmit = vi.fn(); const onOpenChange = vi.fn();
    render(<WizardDialog open onOpenChange={onOpenChange} title="Procedura" steps={steps} onSubmit={onSubmit} />);
    expect(screen.getByText("passo uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("passo due")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Indietro"));
    expect(screen.getByText("passo uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Avanti"));
    fireEvent.click(screen.getByText("Conferma", { selector: "button" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("blocks Avanti when the step's validate returns an error", () => {
    const onSubmit = vi.fn();
    render(<WizardDialog open onOpenChange={() => {}} title="P" onSubmit={onSubmit}
      steps={[{ title: "S1", content: <p>uno</p>, validate: () => "Campo obbligatorio" }, { title: "S2", content: <p>due</p> }]} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("Campo obbligatorio")).toBeInTheDocument();
    expect(screen.getByText("uno")).toBeInTheDocument();
  });
});

test("clamps the step index when the steps array shrinks", async () => {
  function Host() {
    const [n, setN] = useState(2);
    const steps = Array.from({ length: n }, (_, i) => ({ title: `S${i + 1}`, content: <div>body {i + 1}</div> }));
    return (
      <>
        <button onClick={() => setN(1)}>shrink</button>
        <WizardDialog open onOpenChange={() => {}} title="T" steps={steps} />
      </>
    );
  }
  render(<Host />);
  await userEvent.click(screen.getByText("Avanti")); // now on step 2
  expect(screen.getByText("body 2")).toBeInTheDocument();
  fireEvent.click(screen.getByText("shrink"));
  expect(screen.getByText("body 1")).toBeInTheDocument(); // idx clamped, no crash
});
