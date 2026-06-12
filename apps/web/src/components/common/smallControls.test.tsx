import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PagingBar } from "./PagingBar";
import { SearchBox } from "./SearchBox";
import { ToolbarToggle } from "./ToolbarToggle";
import { ToastProvider, useToast } from "./Toast";

describe("PagingBar", () => {
  it("shows position and pages within bounds", () => {
    const onPage = vi.fn();
    render(<PagingBar page={2} pageCount={5} onPage={onPage} />);
    expect(screen.getByText("pagina 2 di 5")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pagina precedente"));
    expect(onPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("Ultima pagina"));
    expect(onPage).toHaveBeenCalledWith(5);
  });
  it("disables backward buttons on the first page", () => {
    render(<PagingBar page={1} pageCount={3} onPage={() => {}} />);
    expect(screen.getByLabelText("Prima pagina")).toBeDisabled();
    expect(screen.getByLabelText("Pagina precedente")).toBeDisabled();
  });
  it("renders nothing when there are no pages", () => {
    const { container } = render(<PagingBar page={1} pageCount={0} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SearchBox / ToolbarToggle", () => {
  it("SearchBox emits text", () => {
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Cerca…"), { target: { value: "banca" } });
    expect(onChange).toHaveBeenCalledWith("banca");
  });
  it("ToolbarToggle toggles", () => {
    const onChange = vi.fn();
    render(<ToolbarToggle label="Nascondi conti vuoti" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Nascondi conti vuoti"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Toast", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("shows a message and auto-dismisses", () => {
    vi.useFakeTimers();
    function Trigger() {
      const toast = useToast();
      return <button onClick={() => toast("Funzione non inclusa nel prototipo")}>go</button>;
    }
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Funzione non inclusa nel prototipo")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.queryByText("Funzione non inclusa nel prototipo")).toBeNull();
  });
});

test("toast timer is cleared on provider unmount (no setState after unmount)", () => {
  vi.useFakeTimers();
  function Fire() { const t = useToast(); return <button onClick={() => t("ciao")}>go</button>; }
  const { unmount } = render(<ToastProvider><Fire /></ToastProvider>);
  fireEvent.click(screen.getByText("go"));
  expect(vi.getTimerCount()).toBe(1); // one pending auto-dismiss timer
  unmount();
  expect(vi.getTimerCount()).toBe(0); // cleanup cleared it
  vi.useRealTimers();
});
