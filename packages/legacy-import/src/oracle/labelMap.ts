import type { DesignNode } from "./designOracle.ts";
import {
  type FixtureNode,
  isControlAccount,
  kidsToPair,
  type MovedKid,
} from "./pairing.ts";

const SEPARATOR = " › ";
const SIDE_LABELS = new Set(["(Assets)", "(Liabilities)"]);

interface Walk {
  labels: Map<string, string>;
  pathOfKey: Map<string, string[]>;
  moved: MovedKid[];
}

/**
 * The design's label paths, each to the fixture key of its node, walking the
 * two trees in the accounts check's pairing order: by position, an
 * oracle-only kid skipped, a moved kid at its key's place in the fixture. A
 * control account is mapped twice, at its full path to its key and at its
 * path without the side level (as the journal export prints a control row)
 * to its account id; its rows are not mapped, since the accounts check pairs
 * them by amount and cannot say which party is which.
 */
export function buildLabelMap<T extends FixtureNode<T>>(
  design: DesignNode,
  fixture: T,
): Map<string, string> {
  const walk: Walk = { labels: new Map(), pathOfKey: new Map(), moved: [] };

  map(design, fixture, [], walk);

  for (const { kid, key } of walk.moved) {
    const parent = parentOf(fixture, key);
    const parentPath =
      parent === undefined ? undefined : walk.pathOfKey.get(parent.key);

    if (parentPath === undefined) {
      throw new Error(
        `a moved row of the design names a key the fixture does not have: ${key}`,
      );
    }

    walk.labels.set([...parentPath, kid.label].join(SEPARATOR), key);
  }

  return walk.labels;
}

function map<T extends FixtureNode<T>>(
  design: DesignNode,
  fixture: T,
  trail: string[],
  walk: Walk,
): void {
  const path = [...trail, design.label];

  walk.labels.set(path.join(SEPARATOR), fixture.key);
  walk.pathOfKey.set(fixture.key, path);

  if (isControlAccount(fixture)) {
    walk.labels.set(
      path
        .filter((label) => {
          return !SIDE_LABELS.has(label);
        })
        .join(SEPARATOR),
      accountIdOf(fixture.key),
    );

    return;
  }

  const { kids, children, moved } = kidsToPair(design, fixture.children);

  walk.moved.push(...moved);

  // Kids and children that differ in number do not pair: the accounts check reports it, and their paths stay unmapped.
  if (kids.length !== children.length) {
    return;
  }

  kids.forEach((kid, index) => {
    map(kid, children[index] as T, path, walk);
  });
}

/** `la157@assets` → `la157`. */
function accountIdOf(key: string): string {
  return key.split("@")[0] as string;
}

function parentOf<T extends FixtureNode<T>>(
  node: T,
  key: string,
): T | undefined {
  for (const child of node.children) {
    if (child.key === key) {
      return node;
    }

    const found = parentOf(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
