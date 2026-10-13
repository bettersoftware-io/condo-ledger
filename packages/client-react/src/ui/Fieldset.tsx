import type { ReactElement, ReactNode } from "react";

import "./Scheda.css";

export function Fieldset({ legend, children }: FieldsetProps): ReactElement {
  return (
    <fieldset className="scheda-fieldset">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

export interface FieldsetProps {
  legend: string;
  children: ReactNode;
}
