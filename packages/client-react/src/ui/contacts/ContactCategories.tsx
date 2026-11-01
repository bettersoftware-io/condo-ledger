import type { ReactElement } from "react";

import type { ContactsView } from "@cl/client-core";

import { TESTIDS } from "../testids.ts";

import "./ContactCategories.css";

/**
 * The Contact Categories card: its tools, then "- All -" with the total and
 * each category by name with its count. A row filters the list at once. ✎ and
 * − act on the selected category, so they are off on "- All -"; the refresh
 * posts its notice for now. Takes only props, so the compiler
 * memoizes it.
 */
export function ContactCategories({
  categories,
  allCount,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onStub,
}: ContactCategoriesProps): ReactElement {
  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function selecting(categoryId: string | null): () => void {
    return (): void => {
      onSelect(categoryId);
    };
  }

  return (
    <section
      className="contact-categories"
      data-testid={TESTIDS.contactCategories}
    >
      <header className="sidebar-card-header">Contact Categories</header>
      <div className="sidebar-tools">
        <button
          type="button"
          className="sidebar-tool"
          data-tone="ok"
          aria-label="Add category"
          onClick={onAdd}
        >
          +
        </button>
        <button
          type="button"
          className="sidebar-tool"
          aria-label="Edit category"
          disabled={selectedId === null}
          onClick={onEdit}
        >
          ✎
        </button>
        <button
          type="button"
          className="sidebar-tool"
          data-tone="neg"
          aria-label="Delete category"
          disabled={selectedId === null}
          onClick={onDelete}
        >
          −
        </button>
        <span className="sidebar-tools-spacer" />
        <button
          type="button"
          className="sidebar-tool"
          aria-label="Refresh"
          onClick={stubbing("Refresh")}
        >
          ⟳
        </button>
      </div>
      <div className="contact-categories-list">
        <CategoryRow
          name="- All -"
          count={allCount}
          selected={selectedId === null}
          onClick={selecting(null)}
        />
        {categories.map(({ category, count }) => {
          return (
            <CategoryRow
              key={category.id}
              name={category.name}
              count={count}
              selected={category.id === selectedId}
              onClick={selecting(category.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

export interface ContactCategoriesProps {
  /** Every category by name, with its count of all contacts. */
  categories: ContactsView["categories"];
  /** The count of all contacts. */
  allCount: number;
  /** The category the list is filtered to; null for all. */
  selectedId: string | null;
  /** A category's id; null for "- All -". */
  onSelect: (categoryId: string | null) => void;
  /** + : asks for a new category. */
  onAdd: () => void;
  /** ✎ : asks to edit the selected category. */
  onEdit: () => void;
  /** − : asks to delete the selected category. */
  onDelete: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

interface CategoryRowProps {
  name: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}

function CategoryRow({
  name,
  count,
  selected,
  onClick,
}: CategoryRowProps): ReactElement {
  return (
    <button
      type="button"
      className="contact-category-row"
      data-testid={TESTIDS.contactCategoryRow}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="contact-category-name">{name}</span>
      <span className="contact-category-count">{count}</span>
    </button>
  );
}
