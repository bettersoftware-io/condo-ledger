import { type ReactElement, useState } from "react";

import { ALL_CONTACTS, type ContactCategory } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { SidebarFrame } from "../shell/SidebarFrame.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { CategoryDialog } from "./CategoryDialog.tsx";
import { ContactCategories } from "./ContactCategories.tsx";
import { ContactFilters } from "./ContactFilters.tsx";
import { contactReasonText } from "./contactReasons.ts";

/**
 * The Contacts module's sidebar, in the shell's frame: the Filter Contacts
 * and Contact Categories cards. Reads the screen's filters, the categories
 * and the buildings, and hands plain props down. Which category dialog is open
 * is its own state: + and ✎ open the New and Edit Category dialog, which closes
 * when its write is accepted, and a category added becomes the one selected;
 * − asks first, and shows a refusal in its question. Its size and fold come from
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
  const { view, typeKeyword, search, setFilter, reset, deleteCategory } =
    useContactsScreen();
  const buildings = useBuildingsTree();
  const { stub } = useNotices();
  const [dialog, setDialog] = useState<CategoryDialogOpen | null>(null);
  const removing = useDialogWrite(closeDialog, "the category was not deleted");
  const filter = view?.filter ?? ALL_CONTACTS;
  const selected =
    view?.categories.find(({ category }) => {
      return category.id === filter.categoryId;
    })?.category ?? null;

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

  function closeDialog(): void {
    setDialog(null);
  }

  function openAdd(): void {
    setDialog({ kind: "edit", category: null });
  }

  function openEdit(): void {
    setDialog({ kind: "edit", category: selected });
  }

  function openDelete(): void {
    removing.forget();
    setDialog({ kind: "delete", category: selected });
  }

  function confirmDelete(): void {
    if (selected !== null) {
      removing.run(() => {
        return deleteCategory(selected.id);
      });
    }
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
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={openDelete}
        onStub={stub}
      />
      {dialog?.kind === "edit" ? (
        <CategoryDialog
          editing={dialog.category}
          onAdded={setCategory}
          onSaved={closeDialog}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "delete" && dialog.category !== null ? (
        <ConfirmAlert
          text={`Delete the category ${dialog.category.name}?`}
          error={
            removing.refusal === null
              ? null
              : contactReasonText(removing.refusal, "")
          }
          onYes={confirmDelete}
          onNo={closeDialog}
        />
      ) : null}
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

/** The category dialog over the sidebar: the New or Edit one, or the question before a delete. */
interface CategoryDialogOpen {
  kind: "edit" | "delete";
  /** The category it acts on; null for a new one. */
  category: ContactCategory | null;
}
