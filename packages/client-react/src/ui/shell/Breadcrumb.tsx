import { Fragment, type ReactElement } from "react";

import type { NavigationState, PeriodSelection } from "@cl/client-core";
import type { Building } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { menuLabel, moduleLabel, periodLabel } from "./labels.tsx";

import "./Breadcrumb.css";

/**
 * Where the person is: the module, and in Buildings the building, the period
 * and the screen; on the Units screen, the selected unit's or group's code
 * after them. The last crumb is the current place.
 */
export function Breadcrumb(): ReactElement {
  const { useNavigation, useBuildingsTree, useSelectedPeriod } = useViewModel();
  const navigation = useNavigation();
  const buildings = useBuildingsTree();
  const { selected } = useSelectedPeriod();
  const crumbs = crumbsOf(navigation.state, buildings, selected);
  const { module, menu } = navigation.state;

  // Only the Units screen reads its selection: elsewhere nothing works out
  // the units for a crumb no one sees.
  return module === "buildings" && menu === "units" ? (
    <UnitsTrail crumbs={crumbs} />
  ) : (
    <Trail crumbs={crumbs} />
  );
}

interface TrailProps {
  crumbs: Crumb[];
}

/** The trail with the Units screen's selection at its end, when it names a unit or a group. */
function UnitsTrail({ crumbs }: TrailProps): ReactElement {
  const { useUnits } = useViewModel();
  const { crumb } = useUnits();

  return (
    <Trail
      crumbs={
        crumb === null ? crumbs : [...crumbs, { part: "unit", text: crumb }]
      }
    />
  );
}

function Trail({ crumbs }: TrailProps): ReactElement {
  return (
    <nav
      className="breadcrumb"
      aria-label="Breadcrumb"
      data-testid={TESTIDS.breadcrumb}
    >
      <span className="breadcrumb-home" aria-hidden="true">
        ⌂
      </span>
      {crumbs.map((crumb, index) => {
        const current = index === crumbs.length - 1;

        return (
          <Fragment key={crumb.part}>
            <span className="breadcrumb-separator" aria-hidden="true">
              ›
            </span>
            <span
              className="breadcrumb-item"
              aria-current={current ? "page" : undefined}
            >
              {crumb.text}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** `Calendar`; `Contacts`; `Buildings › {building} › {period} › {menu item}`, the building and period once a period is chosen. */
function crumbsOf(
  navigation: NavigationState,
  buildings: Building[],
  selected: PeriodSelection | null,
): Crumb[] {
  if (navigation.module !== "buildings") {
    return [{ part: "module", text: moduleLabel(navigation.module) }];
  }

  const building = buildings.find((candidate) => {
    return candidate.id === selected?.buildingId;
  });

  const period = building?.periods.find((candidate) => {
    return candidate.id === selected?.periodId;
  });

  const place: Crumb[] =
    building === undefined || period === undefined
      ? []
      : [
          { part: "building", text: building.name },
          { part: "period", text: periodLabel(period) },
        ];

  return [
    { part: "module", text: moduleLabel("buildings") },
    ...place,
    { part: "menu", text: menuLabel(navigation.menu) },
  ];
}

/** One crumb: the part of the path it names, which keys it (two parts can read the same), and its text. */
interface Crumb {
  part: "module" | "building" | "period" | "menu" | "unit";
  text: string;
}
