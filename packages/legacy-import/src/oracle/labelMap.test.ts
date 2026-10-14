import { describe, expect, it } from "vitest";

import type { DesignNode } from "./designOracle.ts";
import { buildLabelMap } from "./labelMap.ts";

describe("buildLabelMap", () => {
  it("maps every paired node's label path to its key, pairing by position past an oracle-only kid", () => {
    const labels = buildLabelMap(
      createDesign("acc-tot", "Total", [
        createDesign("acc-costi", "Costs", [
          createDesign("acc-p184", "Not in the dump"),
          createDesign("acc-p118", "Cleaning"),
          createDesign("acc-p121", "Gas"),
        ]),
      ]),
      createFixture("total", [
        createFixture("costs", [
          createFixture("la205"),
          createFixture("la208"),
        ]),
      ]),
    );

    expect([...labels]).toEqual([
      ["Total", "total"],
      ["Total › Costs", "costs"],
      ["Total › Costs › Cleaning", "la205"],
      ["Total › Costs › Gas", "la208"],
    ]);
  });

  it("maps a control account at its full path to its key and without its side to its account id, and none of its rows", () => {
    const labels = buildLabelMap(
      createDesign("acc-pat", "Patrimonial", [
        createDesign("acc-pas", "(Liabilities)", [
          createDesign("acc-p54", "Owners (liabilities)", [
            createDesign("acc-x1", "A person"),
          ]),
        ]),
      ]),
      createFixture("patrimonial", [
        createFixture("liabilities", [
          createFixture("la157@liabilities", [
            createFixture("la157@liabilities/md80"),
          ]),
        ]),
      ]),
    );

    expect([...labels]).toEqual([
      ["Patrimonial", "patrimonial"],
      ["Patrimonial › (Liabilities)", "liabilities"],
      [
        "Patrimonial › (Liabilities) › Owners (liabilities)",
        "la157@liabilities",
      ],
      ["Patrimonial › Owners (liabilities)", "la157"],
    ]);
  });

  it("maps a moved kid at the path of its key's place in the fixture, not where the design nests it", () => {
    const labels = buildLabelMap(
      createDesign("acc-costi", "Costs", [
        createDesign("acc-p130", "Water", [
          createDesign("acc-p131", "Water quota"),
          createDesign("acc-p132", "Elevator"),
        ]),
      ]),
      createFixture("costs", [
        createFixture("la217", [createFixture("la218")]),
        createFixture("la219"),
      ]),
    );

    expect(labels.get("Costs › Elevator")).toBe("la219");
    expect(labels.has("Costs › Water › Elevator")).toBe(false);
    expect(labels.get("Costs › Water › Water quota")).toBe("la218");
  });

  it("maps no kid of a node whose kids and children differ in number: the accounts check reports that", () => {
    const labels = buildLabelMap(
      createDesign("acc-costi", "Costs", [
        createDesign("acc-p118", "Cleaning"),
      ]),
      createFixture("costs", [createFixture("la205"), createFixture("la208")]),
    );

    expect([...labels]).toEqual([["Costs", "costs"]]);
  });

  it("refuses a moved kid whose key is not in the fixture", () => {
    expect(() => {
      return buildLabelMap(
        createDesign("acc-p130", "Water", [
          createDesign("acc-p132", "Elevator"),
        ]),
        createFixture("la217"),
      );
    }).toThrow(
      "a moved row of the design names a key the fixture does not have: la219",
    );
  });
});

interface TestNode {
  key: string;
  children: TestNode[];
}

function createDesign(
  id: string,
  label: string,
  kids: DesignNode[] = [],
): DesignNode {
  return { id, label, debit: 0, credit: 0, balance: 0, budget: null, kids };
}

function createFixture(key: string, children: TestNode[] = []): TestNode {
  return { key, children };
}
