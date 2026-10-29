import { describe, expect, it, vi } from "vitest";

import { mountSplitter } from "./Splitter.page.tsx";

describe("Splitter", () => {
  it("reports a vertical splitter's horizontal travel", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "vertical", onDrag });

    page.dragSplitter(40);

    expect(page.direction()).toBe("vertical");
    expect(onDrag).toHaveBeenCalledExactlyOnceWith(40);
  });

  it("reports a horizontal splitter's vertical travel", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "horizontal", onDrag });

    page.dragSplitter(-25);

    expect(page.direction()).toBe("horizontal");
    expect(onDrag).toHaveBeenCalledExactlyOnceWith(-25);
  });

  it("reports each move as the travel since the one before", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "vertical", onDrag });

    page.dragSplitterThrough([10, 30, 5]);

    expect(onDrag.mock.calls).toEqual([[10], [20], [-25]]);
  });

  it("reports nothing for a pointer that moves over it without pressing", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "vertical", onDrag });

    page.hoverSplitter(40);

    expect(onDrag).not.toHaveBeenCalled();
  });

  it("reports nothing once the browser cancels the pointer", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "vertical", onDrag });

    page.dragSplitterAndCancel(10);
    page.hoverSplitter(60);

    expect(onDrag).toHaveBeenCalledExactlyOnceWith(10);
  });

  it("reports nothing once the pointer is let go", () => {
    const onDrag = vi.fn();
    const page = mountSplitter({ direction: "vertical", onDrag });

    page.dragSplitter(10);
    page.hoverSplitter(60);

    expect(onDrag).toHaveBeenCalledExactlyOnceWith(10);
  });
});
