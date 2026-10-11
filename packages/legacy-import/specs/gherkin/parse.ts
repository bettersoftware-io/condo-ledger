export interface Step {
  text: string;
}
export interface Scenario {
  name: string;
  steps: Step[];
}
export interface Feature {
  name: string;
  background: Step[];
  scenarios: Scenario[];
}

const STEP = /^(?:Given|When|Then|And|But)\s+(.*)$/;

function substitute(s: string, row: Record<string, string>): string {
  return s.replace(/<([^>]+)>/g, (_, k: string) => {return row[k] ?? `<${k}>`});
}

/** Minimal Gherkin: Feature, Background, Scenario, Scenario Outline + Examples, steps. */
export function parseFeature(text: string): Feature {
  const feature: Feature = { name: "", background: [], scenarios: [] };
  let mode: "none" | "background" | "scenario" | "outline" | "examples" = "none";
  let scenario: Scenario | null = null;
  let outline: Scenario | null = null;
  let header: string[] | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^Feature:\s*(.*)$/))) { feature.name = m[1]!.trim(); mode = "none"; continue; }
    if (/^Background:/.test(line)) { mode = "background"; continue; }
    if ((m = line.match(/^Scenario Outline:\s*(.*)$/))) { outline = { name: m[1]!.trim(), steps: [] }; scenario = null; header = null; mode = "outline"; continue; }
    if ((m = line.match(/^Scenario:\s*(.*)$/))) { scenario = { name: m[1]!.trim(), steps: [] }; feature.scenarios.push(scenario); outline = null; mode = "scenario"; continue; }
    if (/^Examples:/.test(line)) { header = null; mode = "examples"; continue; }

    if (mode === "examples" && line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => {return c.trim()});
      if (!header) { header = cells; continue; }
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      const label = header.map((h) => {return `${h}=${row[h]}`}).join(", ");
      feature.scenarios.push({
        name: `${outline!.name} — ${label}`,
        steps: outline!.steps.map((s) => {return { text: substitute(s.text, row) }}),
      });
      continue;
    }

    if ((m = line.match(STEP))) {
      const step: Step = { text: m[1]!.trim() };
      if (mode === "background") feature.background.push(step);
      else if (mode === "outline") outline!.steps.push(step);
      else if (mode === "scenario") scenario!.steps.push(step);
      continue;
    }
  }

  return feature;
}
