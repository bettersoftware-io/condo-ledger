import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("tokens define the required theme variables", () => {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  for (const v of [
    "--surface-header", "--accent", "--money-positive", "--money-negative",
    "--row-h", "--sidebar-w", "--font-sans",
  ]) {
    expect(css).toContain(v);
  }
});

test("dark theme overrides core surfaces", () => {
  const css = readFileSync(resolve(__dirname, "theme-dark.css"), "utf8");
  expect(css).toContain('[data-theme="dark"]');
  expect(css).toContain("--surface-app");
});
