import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { fromCents } from "@cl/domain";
import { InlineMoney } from "./inlineEditors";

describe("InlineMoney", () => {
  it("displays formatted money, edits on double-click, commits cents on Enter", () => {
    const onCommit = vi.fn();
    render(<InlineMoney value={fromCents(123456)} onCommit={onCommit} />);
    const display = screen.getByText("1.234,56");
    fireEvent.doubleClick(display);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "2.000,00" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(200000);
  });
  it("Escape cancels without committing", () => {
    const onCommit = vi.fn();
    render(<InlineMoney value={fromCents(100)} onCommit={onCommit} />);
    fireEvent.doubleClick(screen.getByText("1,00"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("1,00")).toBeInTheDocument();
  });
});
