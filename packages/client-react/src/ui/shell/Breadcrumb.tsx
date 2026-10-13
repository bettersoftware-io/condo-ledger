import { Fragment, type ReactElement } from "react";

import type { NavigationState, PeriodSelection } from "@cl/client-core";
import type { Building } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { menuLabel, moduleLabel, periodLabel } from "./labels.tsx";

import "./Breadcrumb.css";

/** Where the person is: the module, and in Buildings the building, the period and the screen. The last crumb is the current place. */
export function Breadcrumb(): ReactElement {
  const { useNavigation, useBuildingsTree, useSelectedPeriod } = useViewModel();
  const navigation = useNavigation();
  const buildings = useBuildingsTree();
  const { selected } = useSelectedPeriod();
  const crumbs = crumbsOf(navigation.state, buildings, selected);

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
          <Fragment key={crumb}>
            <span className="breadcrumb-separator" aria-hidden="true">
              ›
            </span>
            <span
              className="breadcrumb-item"
              aria-current={current ? "page" : undefined}
            >
              {crumb}
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
): string[] {
  if (navigation.module !== "buildings") {
    return [moduleLabel(navigation.module)];
  }

  const building = buildings.find((candidate) => {
    return candidate.id === selected?.buildingId;
  });

  const period = building?.periods.find((candidate) => {
    return candidate.id === selected?.periodId;
  });

  const place =
    building === undefined || period === undefined
      ? []
      : [building.name, periodLabel(period)];

  return [moduleLabel("buildings"), ...place, menuLabel(navigation.menu)];
}
