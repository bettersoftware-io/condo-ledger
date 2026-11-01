import { RotateCcw, Search } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";

import type { ContactFilter } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";

import "./ContactFilters.css";

/**
 * The Filter Contacts card: Natural persons and Companies, the Keyword, the
 * Building and Status selects, and the Search and Reset buttons. A box or a
 * select applies at once; the keyword is typed, and applies on Search or on
 * Enter. Takes only props, so the compiler memoizes it.
 */
export function ContactFilters({
  filter,
  typedKeyword,
  buildings,
  onPersons,
  onCompanies,
  onKeyword,
  onSearch,
  onBuilding,
  onStatus,
  onReset,
}: ContactFiltersProps): ReactElement {
  function reportPersons(event: ChangeEvent<HTMLInputElement>): void {
    onPersons(event.target.checked);
  }

  function reportCompanies(event: ChangeEvent<HTMLInputElement>): void {
    onCompanies(event.target.checked);
  }

  function reportKeyword(event: ChangeEvent<HTMLInputElement>): void {
    onKeyword(event.target.value);
  }

  function searchOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      onSearch();
    }
  }

  function chooseBuilding(value: string): void {
    onBuilding(value === ALL ? null : value);
  }

  function chooseStatus(value: StatusChoice): void {
    onStatus(value === ALL ? null : value);
  }

  const buildingOptions: ValueOption<string>[] = [
    { value: ALL, label: ALL_LABEL },
    ...buildings.map((building) => {
      return { value: building.id, label: building.name };
    }),
  ];

  return (
    <section className="contact-filters" data-testid={TESTIDS.contactFilters}>
      <header className="sidebar-card-header">Filter Contacts</header>
      <div className="contact-filters-body">
        <label className="contact-filters-check">
          <input
            type="checkbox"
            checked={filter.persons}
            onChange={reportPersons}
          />
          Natural persons
        </label>
        <label className="contact-filters-check">
          <input
            type="checkbox"
            checked={filter.companies}
            onChange={reportCompanies}
          />
          Companies
        </label>
        <div className="contact-filters-grid">
          <span className="contact-filters-label">Keyword</span>
          <span className="contact-filters-box">
            <input
              type="text"
              aria-label="Keyword"
              value={typedKeyword}
              onChange={reportKeyword}
              onKeyDown={searchOnEnter}
            />
          </span>
          <span className="contact-filters-label">Building</span>
          <span className="contact-filters-box">
            <ValueSelect
              label="Building"
              options={buildingOptions}
              value={filter.buildingId ?? ALL}
              onChange={chooseBuilding}
            />
          </span>
          <span className="contact-filters-label">Status</span>
          <span className="contact-filters-box">
            <ValueSelect
              label="Status"
              options={STATUS_OPTIONS}
              value={filter.status ?? ALL}
              onChange={chooseStatus}
            />
          </span>
        </div>
        <div className="contact-filters-buttons">
          <button
            type="button"
            className="contact-filters-button"
            data-tone="primary"
            onClick={onSearch}
          >
            <Search size={13} aria-hidden="true" />
            Search
          </button>
          <button
            type="button"
            className="contact-filters-button"
            onClick={onReset}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}

/** A building of the select. */
interface BuildingChoice {
  id: string;
  name: string;
}

export interface ContactFiltersProps {
  /** The filter applied. */
  filter: ContactFilter;
  /** The keyword as typed, applied or not. */
  typedKeyword: string;
  buildings: BuildingChoice[];
  onPersons: (ticked: boolean) => void;
  onCompanies: (ticked: boolean) => void;
  onKeyword: (text: string) => void;
  onSearch: () => void;
  /** A building's id; null for all. */
  onBuilding: (buildingId: string | null) => void;
  onStatus: (status: ContactFilter["status"]) => void;
  onReset: () => void;
}

type StatusChoice = "all" | "active" | "archived";

/** The value of "- All -" in either select. */
const ALL = "all";

const ALL_LABEL = "- All -";

const STATUS_OPTIONS: readonly ValueOption<StatusChoice>[] = [
  { value: ALL, label: ALL_LABEL },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];
