import { describe, it, expect } from "vitest";
import { referencedBankBranchIds } from "../etl/bankClosure.ts";
import { parseInserts } from "../etl/parse.ts";

describe("referencedBankBranchIds", () => {
  it("returns the distinct branch ids used by bank accounts", () => {
    const stmts = parseInserts(fixture);
    const ids = referencedBankBranchIds(stmts, "bankAccount", "bankBranchId");
    expect([...ids].sort()).toEqual(["500", "777"]);
  });
});

// bankAccount rows reference bank_branch via a branch id column.
const fixture = `
INSERT INTO \`bankAccount\` (\`id\`,\`bankBranchId\`) VALUES (1,500),(2,500),(3,777);
`;
