import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { classify, parseDdl, tableColumns } from "../etl/ddl.ts";
import {
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpFile,
} from "./legacyDump.ts";

// Inline fixture exercising every column case plus excluded constraint/key lines.
const fixture = `
DROP TABLE IF EXISTS \`widget\`;
CREATE TABLE \`widget\` (
  \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  \`enabled\` tinyint(1) unsigned NOT NULL DEFAULT '0',
  \`width\` tinyint(4) DEFAULT NULL,
  \`kind\` enum('a','b','c') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'a',
  \`price\` decimal(12,2) DEFAULT NULL,
  \`created\` datetime DEFAULT NULL,
  \`startDate\` date NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`name_UNIQUE\` (\`name\`),
  KEY \`kind_idx\` (\`kind\`),
  CONSTRAINT \`widget_FK\` FOREIGN KEY (\`id\`) REFERENCES \`other\` (\`id\`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
`;

describe("parseDdl", () => {
  it("captures columns in order with correct names and type tokens, dropping constraint/key lines", () => {
    expect(ddl.widget).toEqual([
      { name: "id", sqlType: "int(10)" },
      { name: "name", sqlType: "varchar(255)" },
      { name: "enabled", sqlType: "tinyint(1)" },
      { name: "width", sqlType: "tinyint(4)" },
      { name: "kind", sqlType: "enum('a','b','c')" },
      { name: "price", sqlType: "decimal(12,2)" },
      { name: "created", sqlType: "datetime" },
      { name: "startDate", sqlType: "date" },
    ]);
  });

  it("tableColumns returns names in order", () => {
    expect(tableColumns(ddl, "widget")).toEqual([
      "id",
      "name",
      "enabled",
      "width",
      "kind",
      "price",
      "created",
      "startDate",
    ]);
  });

  const ddl = parseDdl(fixture);
});

describe("classify", () => {
  it("maps tinyint(1) to bool", () => {
    expect(classify("tinyint(1)")).toBe("bool");
  });
  it("maps other tinyint widths to raw", () => {
    expect(classify("tinyint(4)")).toBe("raw");
    expect(classify("tinyint(3)")).toBe("raw");
  });
  it("maps datetime and timestamp to tz", () => {
    expect(classify("datetime")).toBe("tz");
    expect(classify("timestamp")).toBe("tz");
  });
  it("maps date (not datetime) to date", () => {
    expect(classify("date")).toBe("date");
  });
  it("maps everything else to raw", () => {
    expect(classify("int(10)")).toBe("raw");
    expect(classify("varchar(255)")).toBe("raw");
    expect(classify("decimal(12,2)")).toBe("raw");
    expect(classify("enum('a','b')")).toBe("raw");
    expect(classify("text")).toBe("raw");
  });
});

const STRUCTURE = "it-jtime-condominium.structure.sql";

describe.skipIf(!legacyDumpAvailable(STRUCTURE))(
  dumpSuiteName("parseDdl real DDL smoke test", STRUCTURE),
  () => {
    beforeAll(() => {
      ddl = parseDdl(readFileSync(legacyDumpFile(STRUCTURE), "utf8"));
    });

    it("yields 95 tables", () => {
      expect(Object.keys(ddl)).toHaveLength(95);
    });

    it("accountingPeriod has 18 columns", () => {
      expect(ddl.accountingPeriod).toBeDefined();
      expect(ddl.accountingPeriod).toHaveLength(18);
    });

    it("accountingPeriod.created classifies as tz", () => {
      const created = ddl.accountingPeriod!.find((c) => {
        return c.name === "created";
      });
      expect(created).toBeDefined();
      expect(classify(created!.sqlType)).toBe("tz");
    });

    it("accountingPeriod.startDate classifies as date", () => {
      const startDate = ddl.accountingPeriod!.find((c) => {
        return c.name === "startDate";
      });
      expect(startDate).toBeDefined();
      expect(startDate!.sqlType).toBe("date");
      expect(classify(startDate!.sqlType)).toBe("date");
    });

    let ddl: ReturnType<typeof parseDdl>;
  },
);
