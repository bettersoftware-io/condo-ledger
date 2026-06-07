import { render, screen } from "@testing-library/react";
import { fromCents } from "@cl/domain";
import { MoneyText } from "./Money";
import { Coefficient } from "./Coefficient";
import { StatusChip } from "./StatusChip";

test("positive money is blue and formatted", () => {
  render(<MoneyText value={fromCents(123456)} />);
  const el = screen.getByText("1.234,56");
  expect(el).toHaveClass("positive");
});
test("negative money is red", () => {
  render(<MoneyText value={fromCents(-5000)} />);
  expect(screen.getByText("-50,00")).toHaveClass("negative");
});
test("coefficient shows 4 decimals it-IT", () => {
  render(<Coefficient value={12.5} />);
  expect(screen.getByText("12,5000")).toBeInTheDocument();
});
test("status chip renders label", () => {
  render(<StatusChip status="active" />);
  expect(screen.getByText("Attivo")).toBeInTheDocument();
});
