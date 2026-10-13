import {
  Banknote,
  FileText,
  Folder,
  FolderOpen,
  Hash,
  Landmark,
  Sigma,
  Truck,
  Users,
} from "lucide-react";
import type { ReactElement } from "react";

import type { AccountNature, NodeIcon } from "@cl/domain";

import { TESTIDS } from "../testids.ts";

import "./AccountIcon.css";

/**
 * An account's glyph in the chart of accounts: Σ on Total, a folder open or
 * closed and tinted by the account's nature, or the leaf's own kind. The
 * stylesheet does the tinting from `data-nature`; a level with no nature
 * (Patrimonial) is `none`.
 */
export function AccountIcon({
  icon,
  nature,
  open,
  root,
}: AccountIconProps): ReactElement {
  return (
    <span
      className="account-icon"
      data-testid={TESTIDS.accountIcon}
      data-icon={root ? "root" : icon}
      data-nature={nature ?? "none"}
    >
      {glyphOf(icon, open, root)}
    </span>
  );
}

export interface AccountIconProps {
  icon: NodeIcon;
  nature: AccountNature | null;
  /** A folder whose children are shown. */
  open: boolean;
  /** Total, the top of the tree. */
  root: boolean;
}

function glyphOf(icon: NodeIcon, open: boolean, root: boolean): ReactElement {
  if (root) {
    return ROOT;
  }

  if (icon === "folder") {
    return open ? FOLDER_OPEN : FOLDER;
  }

  return GLYPHS[icon];
}

/** The README's emoji, as lucide glyphs. The tax authority shares the bank's Landmark; `data-icon` tells them apart. */
const GLYPHS: Record<Exclude<NodeIcon, "folder">, ReactElement> = {
  document: <FileText size={14} />,
  cash: <Banknote size={14} />,
  bank: <Landmark size={14} />,
  suppliers: <Truck size={14} />,
  owners: <Users size={14} />,
  roundings: <Hash size={14} />,
  tax: <Landmark size={14} />,
};

const ROOT: ReactElement = <Sigma size={14} />;

const FOLDER: ReactElement = <Folder size={14} />;

const FOLDER_OPEN: ReactElement = <FolderOpen size={14} />;
