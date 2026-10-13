import type { ReactElement } from "react";

import "./TopBar.css";

/** The logo tile: a white outlined building with a € badge on the accent (the prototype's header SVG, Condomini.dc.html). */
export function Logo(): ReactElement {
  return (
    <div className="logo-tile">
      <svg
        width="27"
        height="27"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3.2 22.8V8.2l5.8-3 5.8 3v14.6"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <rect x="6" y="9.7" width="2.1" height="2.1" rx=".4" fill="#fff" />
        <rect x="9.9" y="9.7" width="2.1" height="2.1" rx=".4" fill="#fff" />
        <rect x="6" y="13.5" width="2.1" height="2.1" rx=".4" fill="#fff" />
        <rect x="9.9" y="13.5" width="2.1" height="2.1" rx=".4" fill="#fff" />
        <path
          d="M2 22.9h15"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle
          className="logo-badge"
          cx="18.7"
          cy="17.6"
          r="5.3"
          stroke="#fff"
          strokeWidth="1.7"
        />
        <text
          x="18.7"
          y="20.1"
          fontSize="7.2"
          fontWeight="700"
          fill="#fff"
          textAnchor="middle"
          fontFamily="'IBM Plex Sans', sans-serif"
        >
          €
        </text>
      </svg>
    </div>
  );
}
