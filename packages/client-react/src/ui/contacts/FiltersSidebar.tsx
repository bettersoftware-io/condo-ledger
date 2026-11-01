import type { ReactElement } from "react";

import { ALL_CONTACTS } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { SidebarFrame } from "../shell/SidebarFrame.tsx";
import { ContactCategories } from "./ContactCategories.tsx";
import { ContactFilters } from "./ContactFilters.tsx";

/**
 * The Contacts module's sidebar, in the shell's frame: the Filter Contacts
 * and Contact Categories cards. Reads the screen's filters, the categories
 * and the buildings, and hands plain props down. Its size and fold come from
 * the shell, which keeps them while the person visits another module.
 */
export function FiltersSidebar({
  width,
  open,
  maximized,
  onResize,
  onOpen,
  onClose,
  onRestore,
}: FiltersSidebarProps): ReactElement {
  const { useContactsScreen, useBuildingsTree, useNotices } = useViewModel();
  const { view, typeKeyword, search, setFilter, reset } = useContactsScreen();
  const buildings = useBuildingsTree();
  const { stub } = useNotices();
  const filter = view?.filter ?? ALL_CONTACTS;

  function setPersons(persons: boolean): void {
    setFilter({ persons });
  }

  function setCompanies(companies: boolean): void {
    setFilter({ companies });
  }

  function setBuilding(buildingId: string | null): void {
    setFilter({ buildingId });
  }

  function setStatus(status: typeof filter.status): void {
    setFilter({ status });
  }

  function setCategory(categoryId: string | null): void {
    setFilter({ categoryId });
  }

  return (
    <SidebarFrame
      width={width}
      open={open}
      maximized={maximized}
      railLabel="FILTERS"
      railTitle="Open filters"
      onResize={onResize}
      onOpen={onOpen}
      onClose={onClose}
      onRestore={onRestore}
    >
      <ContactFilters
        filter={filter}
        typedKeyword={view?.typedKeyword ?? ""}
        buildings={buildings}
        onPersons={setPersons}
        onCompanies={setCompanies}
        onKeyword={typeKeyword}
        onSearch={search}
        onBuilding={setBuilding}
        onStatus={setStatus}
        onReset={reset}
      />
      <ContactCategories
        categories={view?.categories ?? []}
        allCount={view?.allCount ?? 0}
        selectedId={filter.categoryId}
        onSelect={setCategory}
        onStub={stub}
      />
    </SidebarFrame>
  );
}

export interface FiltersSidebarProps {
  width: number;
  /** The drawer, in compact mode. */
  open: boolean;
  /** A panel of the main area fills the screen: the rail stands in for the sidebar. */
  maximized: boolean;
  onResize: (px: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onRestore: () => void;
}
