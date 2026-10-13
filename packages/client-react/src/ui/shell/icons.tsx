import type { ReactElement } from "react";

import type { Language } from "@cl/domain";

/**
 * The language picker's flags, drawn inline: an emoji flag is a pair of
 * letters on a system without colour flags. Decorative: the picker names the
 * language beside each one.
 */
export const FLAGS: Record<Language, ReactElement> = {
  en: (
    <svg
      className="flag"
      viewBox="0 0 60 30"
      width="16"
      height="11"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="2" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  ),
  it: (
    <svg
      className="flag"
      viewBox="0 0 3 2"
      width="16"
      height="11"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="1" height="2" fill="#009246" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce2b37" />
    </svg>
  ),
  fr: (
    <svg
      className="flag"
      viewBox="0 0 3 2"
      width="16"
      height="11"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="1" height="2" fill="#002654" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce1126" />
    </svg>
  ),
  de: (
    <svg
      className="flag"
      viewBox="0 0 5 3"
      width="16"
      height="11"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="5" height="1" fill="#000" />
      <rect y="1" width="5" height="1" fill="#dd0000" />
      <rect y="2" width="5" height="1" fill="#ffce00" />
    </svg>
  ),
  es: (
    <svg
      className="flag"
      viewBox="0 0 4 4"
      width="16"
      height="11"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="4" height="4" fill="#aa151b" />
      <rect y="1" width="4" height="2" fill="#f1bf00" />
    </svg>
  ),
};

/** The prototype's export glyph: a document in red, lettered PDF. Decorative: the button names the export. */
export const PDF_GLYPH: ReactElement = (
  <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
    <path
      d="M4 1.6h6.4L15 6.1v9.1c0 .7-.5 1.2-1.2 1.2H4c-.7 0-1.2-.5-1.2-1.2V2.8c0-.7.5-1.2 1.2-1.2Z"
      fill="#d8392b"
    />
    <path d="M10.4 1.7 15 6.1h-3.3c-.7 0-1.3-.6-1.3-1.3Z" fill="#f4a99f" />
    <text
      x="8.9"
      y="13.4"
      fontSize="5"
      fontWeight="700"
      fill="#fff"
      textAnchor="middle"
      fontFamily="'IBM Plex Sans',sans-serif"
    >
      PDF
    </text>
  </svg>
);

/** The prototype's export glyph: a document in green, lettered XLS. Decorative: the button names the export. */
export const XLS_GLYPH: ReactElement = (
  <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
    <path
      d="M4 1.6h6.4L15 6.1v9.1c0 .7-.5 1.2-1.2 1.2H4c-.7 0-1.2-.5-1.2-1.2V2.8c0-.7.5-1.2 1.2-1.2Z"
      fill="#1d7a43"
    />
    <path d="M10.4 1.7 15 6.1h-3.3c-.7 0-1.3-.6-1.3-1.3Z" fill="#a7e0bd" />
    <text
      x="8.9"
      y="13.4"
      fontSize="5"
      fontWeight="700"
      fill="#fff"
      textAnchor="middle"
      fontFamily="'IBM Plex Sans',sans-serif"
    >
      XLS
    </text>
  </svg>
);
