import type { OwnerParty } from "#/entities/party.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";

import {
  groupLabelOf,
  levelOf,
  residentsOf,
  restrictionTextOf,
} from "./layout.ts";

/** One row of a table's coefficients: a group, worth the sum of what is under it, or a unit. */
export interface CoefficientNode {
  key: string;
  kind: "group" | "unit";
  label: string;
  /** The unit's restriction, as the schedule writes it; blank on a group and on a unit of the whole period. */
  period: string;
  /** In ten-thousandths. */
  value: number;
  children: CoefficientNode[];
}

/** Each table's total: the plain sum of its coefficients, in ten-thousandths. It is not forced to 1,000. */
export function tableTotalsOf(
  coefficients: Coefficient[],
  tables: ThousandthTable[],
): Map<string, number> {
  const totals = new Map<string, number>(
    tables.map((table) => {
      return [table.id, 0];
    }),
  );

  for (const coefficient of coefficients) {
    const total = totals.get(coefficient.tableId);

    if (total !== undefined) {
      totals.set(coefficient.tableId, total + coefficient.value);
    }
  }

  return totals;
}

/**
 * The table's coefficients as a tree of groups and units, without a root:
 * only the table's restriction group when it has one, otherwise every group
 * and then the units of none.
 */
export function coefficientsTreeOf(
  table: ThousandthTable,
  units: Unit[],
  groups: UnitGroup[],
  coefficients: Coefficient[],
  residents: OwnerParty[],
): CoefficientNode[] {
  const context: TreeContext = {
    groups,
    units,
    residents,
    values: new Map(
      coefficients
        .filter((coefficient) => {
          return coefficient.tableId === table.id;
        })
        .map((coefficient) => {
          return [coefficient.unitId, coefficient.value];
        }),
    ),
  };

  const restriction = groups.find((group) => {
    return group.id === table.restrictionGroupId;
  });

  return restriction === undefined
    ? levelNodes(null, context)
    : [groupNode(restriction, context)];
}

/** What every node of one tree is built from. */
interface TreeContext {
  groups: UnitGroup[];
  units: Unit[];
  residents: OwnerParty[];
  /** The table's coefficient of each unit that has one. */
  values: Map<string, number>;
}

function levelNodes(
  groupId: string | null,
  context: TreeContext,
): CoefficientNode[] {
  const level = levelOf(groupId, context.groups, context.units);

  return [
    ...level.groups.map((group) => {
      return groupNode(group, context);
    }),
    ...level.units.map((unit) => {
      return unitNode(unit, context);
    }),
  ];
}

function groupNode(group: UnitGroup, context: TreeContext): CoefficientNode {
  const children = levelNodes(group.id, context);

  return {
    key: `group:${group.id}`,
    kind: "group",
    label: groupLabelOf(group),
    period: "",
    value: children.reduce((sum, child) => {
      return sum + child.value;
    }, 0),
    children,
  };
}

/** "{code} - {residents' names}", or the code alone for a unit with no residents. */
function unitNode(unit: Unit, context: TreeContext): CoefficientNode {
  const names = residentsOf(context.residents, unit.id).map((resident) => {
    return resident.name;
  });

  return {
    key: `unit:${unit.id}`,
    kind: "unit",
    label:
      names.length === 0 ? unit.code : `${unit.code} - ${names.join(", ")}`,
    period: restrictionTextOf(unit.restriction),
    value: context.values.get(unit.id) ?? 0,
    children: [],
  };
}
