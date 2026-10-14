import { describe, expect, it } from "vitest";

import type { DesignNode } from "./designOracle.ts";
import { deviates, isControlAccount, kidsToPair } from "./pairing.ts";

describe("deviates", () => {
  it("answers whether DEVIATIONS rules that row as that kind", () => {
    expect(deviates("acc-p132", "moved")).toBe(true);
    expect(deviates("acc-p132", "oracle-only")).toBe(false);
    expect(deviates("acc-p1", "moved")).toBe(false);
  });
});

describe("kidsToPair", () => {
  it("leaves out an oracle-only kid, sets a moved one apart with its key, and leaves out the child it is compared at", () => {
    const elevator = createDesign("acc-p132");
    const pairing = kidsToPair(
      createDesign("acc-costi", [
        createDesign("acc-p131"),
        elevator,
        createDesign("acc-p184"),
        createDesign("acc-p118"),
      ]),
      [createFixture("la218"), createFixture("la219"), createFixture("la205")],
    );

    expect(pairing.kids.map(idOf)).toEqual(["acc-p131", "acc-p118"]);
    expect(pairing.children.map(keyOf)).toEqual(["la218", "la205"]);
    expect(pairing.moved).toEqual([{ kid: elevator, key: "la219" }]);
  });
});

describe("isControlAccount", () => {
  it("is a node whose children's keys all extend its own", () => {
    expect(
      isControlAccount(
        createFixture("la157@assets", [
          createFixture("la157@assets/md80"),
          createFixture("la157@assets/md81"),
        ]),
      ),
    ).toBe(true);
  });

  it("is not a grouping, whose children have their own ids, nor a leaf", () => {
    expect(
      isControlAccount(
        createFixture("la217", [
          createFixture("la218"),
          createFixture("la217/md1"),
        ]),
      ),
    ).toBe(false);
    expect(isControlAccount(createFixture("la218"))).toBe(false);
  });

  it("is not a node whose children's ids merely begin with its own", () => {
    expect(
      isControlAccount(
        createFixture("la21", [createFixture("la218"), createFixture("la219")]),
      ),
    ).toBe(false);
  });
});

interface TestNode {
  key: string;
  children: TestNode[];
}

function createDesign(id: string, kids: DesignNode[] = []): DesignNode {
  return { id, label: id, debit: 0, credit: 0, balance: 0, budget: null, kids };
}

function createFixture(key: string, children: TestNode[] = []): TestNode {
  return { key, children };
}

function idOf(node: DesignNode): string {
  return node.id;
}

function keyOf(node: TestNode): string {
  return node.key;
}
