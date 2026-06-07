import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeColumn } from "@cl/application";
import { TreeTable } from "./TreeTable";
import { InlineNumber } from "./inlineEditors";

interface R { id: string; label: string; n: number; kind: string; children?: R[]; }
const rows: R[] = [
  { id: "g", label: "Gruppo", n: 1000, kind: "group", children: [
    { id: "u1", label: "Unità 1", n: 312.5, kind: "unit" },
    { id: "u2", label: "Unità 2", n: 687.5, kind: "unit" },
  ] },
];

test("renders hierarchy expanded with group styling and selection", async () => {
  const onSelect = vi.fn();
  const cols: TreeColumn<R>[] = [
    { id: "label", header: "Nome", cell: (r) => r.label },
    { id: "n", header: "Coeff", align: "right", cell: (r) => String(r.n) },
  ];
  render(<TreeTable rows={rows} columns={cols} getRowKind={(r) => r.kind} onSelect={onSelect} />);
  expect(screen.getByText("Gruppo").closest("tr")).toHaveClass("group");
  expect(screen.getByText("Unità 1")).toBeInTheDocument(); // expanded by default
  await userEvent.click(screen.getByText("Unità 1"));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
});

test("inline editor commits on Enter", async () => {
  const onCommit = vi.fn();
  render(<InlineNumber value={312.5} onCommit={onCommit} />);
  await userEvent.dblClick(screen.getByText("312,5000"));
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "400{Enter}");
  expect(onCommit).toHaveBeenCalledWith(400);
});
