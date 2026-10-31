import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom lays nothing out, so it has no scrollIntoView. A stub, so a component
// can call it and its page object can say what it was called on.
Element.prototype.scrollIntoView = vi.fn();

// Unmounts whatever a test rendered, so one test's screen never leaks into the
// next. The testing library does this by itself only when the test runner's
// globals are switched on, which they are not here.
afterEach(() => {
  cleanup();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
});
