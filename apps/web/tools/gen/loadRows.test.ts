import { describe, it, expect } from "vitest";
import { parseTables } from "./loadRows.ts";

const SQL = `
CREATE TABLE \`thing\` (
  \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
  \`label\` varchar(63) NOT NULL,
  \`amount\` decimal(10,2) DEFAULT NULL,
  \`flag\` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO \`thing\` VALUES ('1', 'A', '12.50', '1'), ('2', 'B', null, '0');
`;

describe("parseTables", () => {
  it("returns DDL-named, type-coerced rows keyed by table", () => {
    const t = parseTables(SQL);
    const rows = t.thing!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "1", label: "A", flag: true });
    expect(rows[1]!.amount).toBeNull();
  });
});
