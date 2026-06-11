import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { parseItMoney } from "./parse";
import { TextField, SelectField, MoneyField, CheckboxField, DateField } from "./fields";

describe("parseItMoney", () => {
  it("parses it-IT formatted strings to cents", () => {
    expect(parseItMoney("1.234,56")).toBe(123456);
    expect(parseItMoney("1234,5")).toBe(123450);
    expect(parseItMoney("-12,00")).toBe(-1200);
    expect(parseItMoney("500")).toBe(50000);
  });
  it("returns null for garbage", () => {
    expect(parseItMoney("abc")).toBeNull();
    expect(parseItMoney("")).toBeNull();
  });
});

describe("fields", () => {
  it("TextField is a labeled controlled input", () => {
    const onChange = vi.fn();
    render(<TextField label="Nome" value="x" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledWith("y");
  });
  it("SelectField renders options and emits values", () => {
    const onChange = vi.fn();
    render(<SelectField label="Tipo" value="a" onChange={onChange}
      options={[{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }]} />);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("MoneyField shows formatted cents and commits parsed cents on blur", () => {
    const onChange = vi.fn();
    render(<MoneyField label="Importo" cents={123456} onChange={onChange} />);
    const input = screen.getByLabelText("Importo") as HTMLInputElement;
    expect(input.value).toBe("1.234,56");
    fireEvent.change(input, { target: { value: "2.000,00" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(200000);
  });
  it("MoneyField keeps the previous value on unparseable input", () => {
    const onChange = vi.fn();
    render(<MoneyField label="Importo" cents={100} onChange={onChange} />);
    const input = screen.getByLabelText("Importo");
    fireEvent.change(input, { target: { value: "boh" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("CheckboxField and DateField round-trip", () => {
    const onCheck = vi.fn(); const onDate = vi.fn();
    render(<>
      <CheckboxField label="Bloccata" checked={false} onChange={onCheck} />
      <DateField label="Scadenza" value="2011-02-01" onChange={onDate} />
    </>);
    fireEvent.click(screen.getByLabelText("Bloccata"));
    expect(onCheck).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByLabelText("Scadenza"), { target: { value: "2011-03-01" } });
    expect(onDate).toHaveBeenCalledWith("2011-03-01");
  });
});
