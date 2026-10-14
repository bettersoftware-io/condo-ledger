import { DEVIATIONS, type DesignNode, type Deviation } from "./designOracle.ts";

/** What pairing reads of a node of the fixture's tree: its key and its children. The fixture's `OracleNode` is one. */
export interface FixtureNode<T> {
  key: string;
  children: T[];
}

/** A kid the design shows somewhere else than the dump: it is compared at the fixture's node of that key. */
export interface MovedKid {
  kid: DesignNode;
  key: string;
}

/** A design node's kids and a fixture node's children, ready to pair by position. */
interface KidsToPair<T> {
  /** The design's kids, less the oracle-only and the moved ones. */
  kids: DesignNode[];
  /** The fixture's children, less those a moved kid is compared at. */
  children: T[];
  /** The kids the design shows elsewhere, each with the fixture key it is compared at. */
  moved: MovedKid[];
}

/** Whether DEVIATIONS rules this oracle row as that kind of deviation. */
export function deviates(oracleId: string, kind: Deviation["kind"]): boolean {
  return DEVIATIONS.some((deviation) => {
    return deviation.oracleId === oracleId && deviation.kind === kind;
  });
}

/**
 * The kids of a design node and the children of its fixture node that pair
 * by position: an oracle-only kid is left out, a moved one is set apart with
 * its key, and the fixture child a moved kid is compared at is left out.
 */
export function kidsToPair<T extends FixtureNode<T>>(
  design: DesignNode,
  children: T[],
): KidsToPair<T> {
  const kids = design.kids.filter((kid) => {
    return !deviates(kid.id, "oracle-only");
  });

  const movedKeys = new Set(
    DEVIATIONS.flatMap((deviation) => {
      return deviation.kind === "moved" && deviation.fixtureKey !== undefined
        ? [deviation.fixtureKey]
        : [];
    }),
  );

  return {
    kids: kids.filter((kid) => {
      return !deviates(kid.id, "moved");
    }),
    children: children.filter((child) => {
      return !movedKeys.has(child.key);
    }),
    moved: kids.flatMap((kid) => {
      const key = movedKeyOf(kid.id);

      return key === undefined ? [] : [{ kid, key }];
    }),
  };
}

/** A control account's node: its rows' keys extend its own (`la157@assets/md80`), where an account's children have their own ids. */
export function isControlAccount<T extends FixtureNode<T>>(node: T): boolean {
  return (
    node.children.length > 0 &&
    node.children.every((child) => {
      return child.key.startsWith(`${node.key}/`);
    })
  );
}

function movedKeyOf(oracleId: string): string | undefined {
  return DEVIATIONS.find((deviation) => {
    return deviation.oracleId === oracleId && deviation.kind === "moved";
  })?.fixtureKey;
}
