import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectionPanel } from "./SectionPanel";
import { STANDARD_ACTIONS } from "../common/ActionToolbar";
import { DetailPanel } from "./DetailPanel";
import { FormCard, FieldGroup, Field } from "./FormCard";

test("section panel shows title, count and actions", () => {
  render(<SectionPanel title="Dati Condominio" actions={STANDARD_ACTIONS} count={2} countNoun="condomini"><div>body</div></SectionPanel>);
  expect(screen.getByText("Dati Condominio")).toBeInTheDocument();
  expect(screen.getByText("2 condomini")).toBeInTheDocument();
  expect(screen.getByLabelText("Aggiungi")).toBeInTheDocument();
});
test("detail tabs switch", async () => {
  render(<DetailPanel tabs={[
    { id: "a", label: "Scheda", content: <FormCard><FieldGroup title="X"><Field label="Codice" value="SAT" /></FieldGroup></FormCard> },
    { id: "b", label: "Fornitori", content: <div>suppliers</div> },
  ]} />);
  expect(screen.getByText("SAT")).toBeVisible();
  await userEvent.click(screen.getByText("Fornitori"));
  expect(screen.getByText("suppliers")).toBeVisible();
});
