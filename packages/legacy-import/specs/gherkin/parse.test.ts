import { describe, it, expect } from "vitest";
import { parseFeature } from "./parse.ts";

const FEATURE = `
Feature: Demo
  Background:
    Given the legacy data for period "Saturno 2011"
  Scenario: a plain scenario
    When I do a thing
    Then it works
  Scenario Outline: per period
    Then period "<period>" reconciles
    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
`;

describe("parseFeature", () => {
  it("captures the feature name and background", () => {
    expect(f.name).toBe("Demo");
    expect(f.background.map((s) => {return s.text})).toEqual([`the legacy data for period "Saturno 2011"`]);
  });
  it("captures a plain scenario's steps (keyword stripped)", () => {
    const plain = f.scenarios.find((s) => {return s.name.startsWith("a plain scenario")})!;
    expect(plain.steps.map((s) => {return s.text})).toEqual(["I do a thing", "it works"]);
  });
  it("expands a scenario outline over its examples", () => {
    const expanded = f.scenarios.filter((s) => {return s.name.startsWith("per period")});
    expect(expanded).toHaveLength(2);
    expect(expanded[0]!.steps[0]!.text).toBe(`period "Saturno 2011" reconciles`);
    expect(expanded[1]!.steps[0]!.text).toBe(`period "Pozzetto 2013" reconciles`);
  });

  const f = parseFeature(FEATURE);
});
