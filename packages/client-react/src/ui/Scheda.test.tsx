import { describe, expect, it } from "vitest";

import { Fieldset } from "./Fieldset.tsx";
import { Row } from "./Row.tsx";
import { mountScheda } from "./Scheda.page.tsx";

describe("Scheda", () => {
  it("renders a row's label and value with its tone", () => {
    const page = mountScheda(
      <Row label="Balance" tone="num">
        1,234.56
      </Row>,
    );

    expect(page.valueOf("Balance")).toBe("1,234.56");
    expect(page.toneOf("Balance")).toBe("num");
  });

  it("has no tone unless given", () => {
    const page = mountScheda(<Row label="Name">Rossi</Row>);

    expect(page.toneOf("Name")).toBeUndefined();
  });

  it("is narrow unless wide", () => {
    expect(mountScheda("x").isWide()).toBe(false);
  });

  it("is wide when asked", () => {
    expect(mountScheda("x", true).isWide()).toBe(true);
  });

  it("groups rows under a legend", () => {
    const page = mountScheda(
      <Fieldset legend="Bank">
        <Row label="IBAN">IT00</Row>
      </Fieldset>,
    );

    expect(page.hasGroup("Bank")).toBe(true);
    expect(page.valueOf("IBAN")).toBe("IT00");
    expect(page.rowCount()).toBe(1);
  });
});
